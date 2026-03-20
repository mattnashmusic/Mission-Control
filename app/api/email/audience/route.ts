import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { calculateClusterShares } from "@/lib/email/audience";

type RawRow = {
  email: string;
  country: string;
  city: string;
  zip: string;
};

type GeocodedCluster = {
  city: string;
  country: string;
  lat: number;
  lng: number;
  count: number;
  emails: string[];
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
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    if (!token) {
      return new NextResponse("Missing NEXT_PUBLIC_MAPBOX_TOKEN in .env.local", {
        status: 500,
      });
    }

    const filePath = path.join(process.cwd(), "data", "subscribers_active.csv");
    const rawFile = await fs.readFile(filePath, "utf8");

    const rows = parseTsv(rawFile);

    const cleanedRows = rows
      .map(normalizeRow)
      .filter((row): row is RawRow => row !== null);

    const grouped = new Map<
      string,
      { city: string; country: string; count: number; emails: string[] }
    >();

    for (const row of cleanedRows) {
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
      const coords = await geocodeCity(item.city, item.country, token);
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
        totalRows: rows.length,
        usableRows: cleanedRows.length,
        skippedRows: rows.length - cleanedRows.length,
        uniqueCities: uniqueCities.length,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build audience data";

    return new NextResponse(message, { status: 500 });
  }
}

function parseTsv(input: string) {
  const lines = input
    .replace(/\r/g, "")
    .split("\n")
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) return [];

  const headers = splitTsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = splitTsvLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });

    return row;
  });
}

function splitTsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "\t" && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result.map((value) => value.trim());
}

function normalizeRow(row: Record<string, string>): RawRow | null {
  const email = (row["Subscriber"] || "").trim().toLowerCase();
  const city = normalizeCity(row["City"] || "");
  const country = normalizeCountry(row["Country"] || row["Location"] || "");
  const zip = (row["Zip"] || "").trim();

  if (!email || !city || !country) {
    return null;
  }

  return { email, city, country, zip };
}

function normalizeCity(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  return trimmed
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeCountry(value: string) {
  const trimmed = value.trim();
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