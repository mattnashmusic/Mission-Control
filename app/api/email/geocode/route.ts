import { NextResponse } from "next/server";
import { searchPlaces } from "@/lib/email/geocode";

// Free-text city search for the email tab's "search any city" box. Lets
// Matt target any place (e.g. "Hanover") instead of being limited to a
// small hardcoded list of cities.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  if (!query.trim()) {
    return NextResponse.json({ matches: [] });
  }

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!mapboxToken) {
    return new NextResponse("Missing NEXT_PUBLIC_MAPBOX_TOKEN in .env.local", {
      status: 500,
    });
  }

  try {
    const matches = await searchPlaces(query, mapboxToken, 6);
    return NextResponse.json({ matches });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Geocoding failed";
    return new NextResponse(message, { status: 500 });
  }
}
