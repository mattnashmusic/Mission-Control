import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const response = await fetch(
      "https://mission-control-silk-one.vercel.app/api/tourvote",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "Debug TourVote",
          email: `tourvote-debug-${Date.now()}@gmail.com`,
          selectedCity: "Amsterdam",
          selectedCountry: "NL",
          inferredCity: "Amsterdam",
          inferredCountry: "NL",
          source: "tourvote",
          debugMailerLite: true,
        }),
      }
    );

    const json = await response.json();

    return NextResponse.json(json);
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown error",
    });
  }
}