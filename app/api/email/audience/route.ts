import { NextResponse } from "next/server";
import { calculateClusterShares } from "@/lib/email/audience";
import { geocodeCity } from "@/lib/email/geocode";
import { getMergedAudience } from "@/lib/email/mergedAudience";

type GeocodedCluster = {
  city: string;
  country: string;
  lat: number;
  lng: number;
  count: number;
  emails: string[];
  mailerLiteEmails: string[];
  shopifyOnlyEmails: string[];
};

export async function GET() {
  try {
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!mapboxToken) {
      return new NextResponse("Missing NEXT_PUBLIC_MAPBOX_TOKEN in .env.local", {
        status: 500,
      });
    }

    const merged = await getMergedAudience();

    const grouped = new Map<
      string,
      {
        city: string;
        country: string;
        count: number;
        emails: string[];
        mailerLiteEmails: string[];
        shopifyOnlyEmails: string[];
      }
    >();

    for (const row of merged.usableRows) {
      const key = `${row.city}__${row.country}`;
      const existing = grouped.get(key);

      const bucket =
        existing ??
        grouped
          .set(key, {
            city: row.city,
            country: row.country,
            count: 0,
            emails: [],
            mailerLiteEmails: [],
            shopifyOnlyEmails: [],
          })
          .get(key)!;

      bucket.count += 1;
      bucket.emails.push(row.email);

      // `row.source` here reflects where the *location* data ultimately
      // came from after merging (see mergeAudienceRows), which is
      // deliberately biased toward "mailerlite" whenever a contact is an
      // actual MailerLite subscriber. That makes it a reliable signal for
      // "is this person opted in to receive email" — Shopify-only rows are
      // customers we have an address for but who were never subscribed,
      // so they should never be silently imported into a MailerLite group.
      if (row.source === "mailerlite") {
        bucket.mailerLiteEmails.push(row.email);
      } else {
        bucket.shopifyOnlyEmails.push(row.email);
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
        mailerLiteEmails: item.mailerLiteEmails,
        shopifyOnlyEmails: item.shopifyOnlyEmails,
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
