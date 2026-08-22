import { prisma } from "@/lib/prisma";

// Shared "who can we actually email" logic: merges MailerLite subscribers
// with Shopify customers, deduped by email. Used by both the email tab's
// audience map (app/api/email/audience) and the homepage's Email card
// (app/page.tsx), so the two never drift apart on what counts as a contact.

export type AudienceRow = {
  email: string;
  country: string;
  city: string;
  zip: string;
  source: "mailerlite" | "shopify";
};

type MailerLiteSubscriber = {
  id: string;
  email: string;
  status: string;
  fields?: Record<string, string | null>;
  groups?: Array<{
    name?: string;
  }>;
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

export async function getMergedAudience(): Promise<{
  totalSourceRows: number;
  allRows: AudienceRow[];
  usableRows: AudienceRow[];
}> {
  const [mailerLiteRows, shopifyRows] = await Promise.all([
    fetchMailerLiteActiveSubscribers(),
    fetchShopifyAudienceRows(),
  ]);

  return mergeAudienceRows(mailerLiteRows, shopifyRows);
}

export async function fetchMailerLiteActiveSubscribers(): Promise<AudienceRow[]> {
  const token =
    process.env.MAILERLITE_API_TOKEN ||
    process.env.MAILERLITE_TOKEN ||
    process.env.MAILERLITE_API_KEY;

  if (!token) {
    throw new Error(
      "Missing MAILERLITE_API_TOKEN (or MAILERLITE_TOKEN / MAILERLITE_API_KEY)"
    );
  }

  const rows: AudienceRow[] = [];
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

      const groupNames = (subscriber.groups ?? [])
        .map((group) => group?.name ?? "")
        .filter(Boolean);

      const inferredLocation = inferLocationFromText(
        [
          ...groupNames,
          readFirstString(
            fields.tour_vote_source,
            fields.signup_source,
            fields.source,
            fields.Source
          ),
        ].join(" ")
      );

      const city = normalizeCity(
        readFirstString(
          fields.city,
          fields.City,
          fields.town,
          fields.Town,
          fields.tour_vote_city,
          fields.tour_vote_inferred_city,
          inferredLocation.city
        )
      );

      const country = normalizeCountry(
        readFirstString(
          fields.country,
          fields.Country,
          fields.location,
          fields.Location,
          fields.tour_vote_country,
          fields.tour_vote_inferred_country,
          inferredLocation.country
        )
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

export async function fetchShopifyAudienceRows(): Promise<AudienceRow[]> {
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
    .filter((row): row is AudienceRow => row !== null);
}

function mapShopifyCustomerToAudienceRow(
  customer: ShopifyCustomerRow
): AudienceRow | null {
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

export function mergeAudienceRows(
  mailerLiteRows: AudienceRow[],
  shopifyRows: AudienceRow[]
): {
  totalSourceRows: number;
  allRows: AudienceRow[];
  usableRows: AudienceRow[];
} {
  const merged = new Map<string, AudienceRow>();

  // Shopify goes first so it can supply address data, then MailerLite can
  // add/override with tour vote and group-derived location data where better.
  for (const row of [...shopifyRows, ...mailerLiteRows]) {
    const key = normalizeEmail(row.email);
    if (!key) continue;

    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, { ...row, email: key });
      continue;
    }

    const existingHasLocation = !!existing.city && !!existing.country;
    const rowHasLocation = !!row.city && !!row.country;

    const next: AudienceRow = {
      email: key,
      source:
        existing.source === "mailerlite" || row.source === "mailerlite"
          ? "mailerlite"
          : "shopify",
      city: existing.city,
      country: existing.country,
      zip: existing.zip || row.zip,
    };

    if (!existingHasLocation && rowHasLocation) {
      next.city = row.city;
      next.country = row.country;
      next.zip = row.zip || next.zip;
    }

    // Prefer MailerLite when it has explicit/tour/group location, because
    // that is often more relevant for live/tour grouping than billing address.
    if (row.source === "mailerlite" && rowHasLocation) {
      next.city = row.city;
      next.country = row.country;
      next.zip = row.zip || next.zip;
    }

    merged.set(key, next);
  }

  const allRows = Array.from(merged.values());
  const usableRows = allRows.filter((row) => !!row.city && !!row.country);

  return {
    totalSourceRows: mailerLiteRows.length + shopifyRows.length,
    allRows,
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

function inferLocationFromText(value: string): {
  city: string;
  country: string;
} {
  const normalized = value.toLowerCase();

  const cityCountryMap: Array<{
    city: string;
    country: string;
    matches: string[];
  }> = [
    {
      city: "Hamburg",
      country: "Germany",
      matches: ["hamburg"],
    },
    {
      city: "Berlin",
      country: "Germany",
      matches: ["berlin"],
    },
    {
      city: "Cologne",
      country: "Germany",
      matches: ["cologne", "köln"],
    },
    {
      city: "Hannover",
      country: "Germany",
      matches: ["hannover"],
    },
    {
      city: "Amsterdam",
      country: "Netherlands",
      matches: ["amsterdam"],
    },
  ];

  for (const item of cityCountryMap) {
    if (item.matches.some((match) => normalized.includes(match))) {
      return {
        city: item.city,
        country: item.country,
      };
    }
  }

  return {
    city: "",
    country: "",
  };
}
