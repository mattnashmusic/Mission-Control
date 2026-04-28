import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateClusterShares } from "@/lib/email/audience";

type RawRow = {
  email: string;
  country: string;
  city: string;
  zip: string;
  source: "mailerlite" | "shopify" | "abandoned";
};

type GeocodedCluster = {
  city: string;
  country: string;
  lat: number;
  lng: number;
  count: number;
  emails: string[];
};

type MailerLiteSubscriber = {
  id: string;
  email: string;
  status: string;
  fields?: Record<string, string | null>;
};

type MailerLiteListResponse = {
  data?: MailerLiteSubscriber[];
  meta?: {
    next_cursor?: string | null;
  };
};

type ShopifyCustomerRow = {
  id: string;
  email: string | null;
  country: string | null;
  countryCode: string | null;
  rawJson: unknown;
};

type ShopifyAbandonedCheckout = {
  id?: number | string;
  email?: string | null;
  abandoned_checkout_url?: string | null;
  created_at?: string | null;
  billing_address?: {
    city?: string | null;
    country?: string | null;
    country_code?: string | null;
    zip?: string | null;
  } | null;
  shipping_address?: {
    city?: string | null;
    country?: string | null;
    country_code?: string | null;
    zip?: string | null;
  } | null;
  customer?: {
    email?: string | null;
    default_address?: {
      city?: string | null;
      country?: string | null;
      country_code?: string | null;
      zip?: string | null;
    } | null;
  } | null;
};

type ShopifyAbandonedCheckoutResponse = {
  checkouts?: ShopifyAbandonedCheckout[];
};

const geocodeCache = new Map<string, { lat: number; lng: number } | null>();

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  australia: "AU",
  austria: "AT",
  belgium: "BE",
  canada: "CA",
  france: "FR",
  germany: "DE",
  ireland: "IE",
  italy: "IT",
  netherlands: "NL",
  spain: "ES",
  switzerland: "CH",
  "united kingdom": "GB",
  uk: "GB",
  "great britain": "GB",
  england: "GB",
  "united states": "US",
  usa: "US",
};

export async function GET() {
  try {
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!mapboxToken) {
      return new NextResponse("Missing NEXT_PUBLIC_MAPBOX_TOKEN in .env.local", {
        status: 500,
      });
    }

    const [mailerLiteRows, shopifyRows, abandonedRows] = await Promise.all([
      fetchMailerLiteActiveSubscribers(),
      fetchShopifyAudienceRows(),
      fetchShopifyAbandonedCheckoutRows(),
    ]);

    const merged = mergeAudienceRows(mailerLiteRows, shopifyRows, abandonedRows);

    const grouped = new Map<
      string,
      { city: string; country: string; count: number; emails: string[] }
    >();

    for (const row of merged.usableRows) {
      const key = `${row.city}__${row.country}`;
      const existing = grouped.get(key);

      if (existing) {
        existing.count += 1;
        existing.emails.push(row.email);
      } else {
        grouped.set(key, {
          city: row.city,
          country: row.country,
          count: 1,
          emails: [row.email],
        });
      }
    }

    const uniqueCities = Array.from(grouped.values());

    const geocoded = await mapWithConcurrency(uniqueCities, 5, async (item) => {
      const coords = await geocodeCity(item.city, item.country, mapboxToken);
      if (!coords) return null;

      return {
        city: item.city,
        country: item.country,
        count: item.count,
        lat: coords.lat,
        lng: coords.lng,
        emails: item.emails,
      };
    });

    const clusters = calculateClusterShares(
      geocoded.filter((item): item is GeocodedCluster => item !== null)
    );

    return NextResponse.json({
      clusters,
      stats: {
        totalRows: merged.totalSourceRows,
        usableRows: merged.usableRows.length,
        skippedRows: merged.totalSourceRows - merged.usableRows.length,
        uniqueCities: uniqueCities.length,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build audience data";

    return new NextResponse(message, { status: 500 });
  }
}

async function fetchMailerLiteActiveSubscribers(): Promise<RawRow[]> {
  const token =
    process.env.MAILERLITE_API_TOKEN ||
    process.env.MAILERLITE_TOKEN ||
    process.env.MAILERLITE_API_KEY;

  if (!token) {
    throw new Error(
      "Missing MAILERLITE_API_TOKEN (or MAILERLITE_TOKEN / MAILERLITE_API_KEY)"
    );
  }

  const rows: RawRow[] = [];
  let cursor: string | null = null;

  while (true) {
    const url = new URL("https://connect.mailerlite.com/api/subscribers");
    url.searchParams.set("filter[status]", "active");
    url.searchParams.set("limit", "100");

    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`MailerLite fetch failed: ${response.status} ${text}`);
    }

    const json = (await response.json()) as MailerLiteListResponse;
    const subscribers = json.data ?? [];

    for (const subscriber of subscribers) {
      const email = normalizeEmail(subscriber.email);
      if (!email) continue;

      const fields = subscriber.fields ?? {};
      const city = normalizeCity(
        readFirstString(fields.city, fields.City, fields.town, fields.Town)
      );
      const country = normalizeCountry(
        readFirstString(fields.country, fields.Country, fields.location, fields.Location)
      );
      const zip = readFirstString(
        fields.z_i_p,
        fields.zip,
        fields.Zip,
        fields.postcode,
        fields.Postcode
      ).trim();

      rows.push({
        email,
        city,
        country,
        zip,
        source: "mailerlite",
      });
    }

    cursor = json.meta?.next_cursor ?? null;
    if (!cursor) break;
  }

  return rows;
}

async function fetchShopifyAudienceRows(): Promise<RawRow[]> {
  const customers = await prisma.shopifyCustomer.findMany({
    select: {
      id: true,
      email: true,
      country: true,
      countryCode: true,
      rawJson: true,
    },
  });

  return customers
    .map(mapShopifyCustomerToAudienceRow)
    .filter((row): row is RawRow => row !== null);
}

function mapShopifyCustomerToAudienceRow(
  customer: ShopifyCustomerRow
): RawRow | null {
  const email = normalizeEmail(customer.email);
  if (!email) return null;

  const raw = isObject(customer.rawJson) ? customer.rawJson : null;
  const defaultAddress = isObject(raw?.default_address) ? raw.default_address : null;
  const addresses = Array.isArray(raw?.addresses) ? raw.addresses : [];
  const firstAddress = addresses.find(isObject) ?? null;

  const city = normalizeCity(readFirstString(defaultAddress?.city, firstAddress?.city));
  const country = normalizeCountry(
    readFirstString(
      customer.country,
      customer.countryCode,
      defaultAddress?.country,
      defaultAddress?.country_name,
      defaultAddress?.country_code,
      firstAddress?.country,
      firstAddress?.country_name,
      firstAddress?.country_code
    )
  );
  const zip = readFirstString(defaultAddress?.zip, firstAddress?.zip).trim();

  return {
    email,
    city,
    country,
    zip,
    source: "shopify",
  };
}

async function fetchShopifyAbandonedCheckoutRows(): Promise<RawRow[]> {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

  if (!storeDomain || !accessToken) {
    throw new Error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ACCESS_TOKEN");
  }

  const rows: RawRow[] = [];
  let pageInfoUrl: string | null = `https://${storeDomain}/admin/api/2026-01/checkouts.json?limit=250`;

  while (pageInfoUrl) {
    const response = await fetch(pageInfoUrl, {
      method: "GET",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Shopify abandoned checkouts fetch failed: ${response.status} ${text}`);
    }

    const json = (await response.json()) as ShopifyAbandonedCheckoutResponse;
    const checkouts = json.checkouts ?? [];

    for (const checkout of checkouts) {
      const row = mapAbandonedCheckoutToAudienceRow(checkout);
      if (row) rows.push(row);
    }

    pageInfoUrl = getNextLinkFromHeader(response.headers.get("link"));
  }

  return rows;
}

function mapAbandonedCheckoutToAudienceRow(
  checkout: ShopifyAbandonedCheckout
): RawRow | null {
  const email = normalizeEmail(
    checkout.email || checkout.customer?.email || ""
  );
  if (!email) return null;

  const shipping = checkout.shipping_address ?? null;
  const billing = checkout.billing_address ?? null;
  const customerDefault = checkout.customer?.default_address ?? null;

  const city = normalizeCity(
    readFirstString(shipping?.city, billing?.city, customerDefault?.city)
  );

  const country = normalizeCountry(
    readFirstString(
      shipping?.country,
      shipping?.country_code,
      billing?.country,
      billing?.country_code,
      customerDefault?.country,
      customerDefault?.country_code
    )
  );

  const zip = readFirstString(
    shipping?.zip,
    billing?.zip,
    customerDefault?.zip
  ).trim();

  return {
    email,
    city,
    country,
    zip,
    source: "abandoned",
  };
}

function mergeAudienceRows(
  mailerLiteRows: RawRow[],
  shopifyRows: RawRow[],
  abandonedRows: RawRow[]
): {
  totalSourceRows: number;
  usableRows: RawRow[];
} {
  const merged = new Map<string, RawRow>();

  for (const row of [...abandonedRows, ...shopifyRows, ...mailerLiteRows]) {
    const key = normalizeEmail(row.email);
    if (!key) continue;

    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, { ...row, email: key });
      continue;
    }

    const next: RawRow = {
      email: key,
      source:
        existing.source === "mailerlite" || row.source === "mailerlite"
          ? "mailerlite"
          : existing.source === "shopify" || row.source === "shopify"
          ? "shopify"
          : "abandoned",
      city: existing.city,
      country: existing.country,
      zip: existing.zip || row.zip,
    };

    if (!next.city && row.city) next.city = row.city;
    if (!next.country && row.country) next.country = row.country;

    if (
      row.source === "mailerlite" &&
      row.city &&
      row.country &&
      (!existing.city || !existing.country)
    ) {
      next.city = row.city;
      next.country = row.country;
      next.zip = row.zip || next.zip;
    }

    merged.set(key, next);
  }

  const usableRows = Array.from(merged.values()).filter(
    (row) => !!row.email && !!row.city && !!row.country
  );

  return {
    totalSourceRows: mailerLiteRows.length + shopifyRows.length + abandonedRows.length,
    usableRows,
  };
}

function normalizeEmail(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function normalizeCity(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";

  return trimmed
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeCountry(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";

  const lower = trimmed.toLowerCase();

  if (lower === "de") return "Germany";
  if (lower === "nl") return "Netherlands";
  if (lower === "be") return "Belgium";
  if (lower === "fr") return "France";
  if (lower === "ch") return "Switzerland";
  if (lower === "uk" || lower === "gb") return "United Kingdom";
  if (lower === "us" || lower === "usa") return "United States";

  return trimmed
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function readFirstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return "";
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNextLinkFromHeader(linkHeader: string | null): string | null {
  if (!linkHeader) return null;

  const parts = linkHeader.split(",");
  for (const part of parts) {
    const match = part.match(/<([^>]+)>;\s*rel="next"/);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

async function geocodeCity(city: string, country: string, token: string) {
  const cacheKey = `${city}__${country}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) ?? null;
  }

  const countryCode = toCountryCode(country);
  const q = `${city}, ${country}`;

  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", q);
  url.searchParams.set("types", "place");
  url.searchParams.set("limit", "1");
  url.searchParams.set("access_token", token);

  if (countryCode) {
    url.searchParams.set("country", countryCode);
  }

  const response = await fetch(url.toString(), {
    headers: {
      "Content-Type": "application/json",
    },
    cache: "force-cache",
  });

  if (!response.ok) {
    geocodeCache.set(cacheKey, null);
    return null;
  }

  const json = await response.json();
  const feature = json.features?.[0];
  const coordinates = feature?.geometry?.coordinates;

  if (
    !Array.isArray(coordinates) ||
    typeof coordinates[0] !== "number" ||
    typeof coordinates[1] !== "number"
  ) {
    geocodeCache.set(cacheKey, null);
    return null;
  }

  const result = {
    lng: coordinates[0],
    lat: coordinates[1],
  };

  geocodeCache.set(cacheKey, result);
  return result;
}

function toCountryCode(country: string) {
  return COUNTRY_NAME_TO_CODE[country.toLowerCase()] || "";
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );

  return results;
}