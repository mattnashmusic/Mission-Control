import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geocodeCity } from "@/lib/email/geocode";

// Upcoming shows, geocoded, for the email tab's "target this show" picker.
// This reuses the same Show data that powers the Tour and Funnels tabs, so
// the email tab no longer has its own disconnected, hand-typed city list.
export async function GET() {
  try {
    const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!mapboxToken) {
      return new NextResponse("Missing NEXT_PUBLIC_MAPBOX_TOKEN in .env.local", {
        status: 500,
      });
    }

    const shows = await prisma.show.findMany({
      where: { date: { gte: startOfToday() } },
      orderBy: { date: "asc" },
      select: {
        id: true,
        slug: true,
        date: true,
        city: true,
        country: true,
        venue: true,
      },
    });

    const geocoded = await Promise.all(
      shows.map(async (show) => {
        const coords = await geocodeCity(show.city, show.country, mapboxToken);
        if (!coords) return null;

        return {
          id: show.id,
          slug: show.slug,
          date: show.date.toISOString(),
          city: show.city,
          country: show.country,
          venue: show.venue,
          lat: coords.lat,
          lng: coords.lng,
        };
      })
    );

    return NextResponse.json({
      shows: geocoded.filter((show): show is NonNullable<typeof show> => show !== null),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load upcoming shows";
    return new NextResponse(message, { status: 500 });
  }
}

function startOfToday() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
