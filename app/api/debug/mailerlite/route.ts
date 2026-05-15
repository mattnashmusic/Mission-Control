import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const apiKey = process.env.MAILERLITE_API_KEY;
    const groupId =
      process.env.MAILERLITE_TOUR_VOTE_GROUP_ID;

    if (!apiKey) {
      return NextResponse.json({
        ok: false,
        error: "MAILERLITE_API_KEY missing",
      });
    }

    if (!groupId) {
      return NextResponse.json({
        ok: false,
        error:
          "MAILERLITE_TOUR_VOTE_GROUP_ID missing",
      });
    }

    const testEmail = `debug-${Date.now()}@mattnash.com`;

    const payload = {
      email: testEmail,
      fields: {
        name: "Debug Test",
        tour_vote_city: "Amsterdam",
        tour_vote_country: "NL",
        tour_vote_inferred_city: "Amsterdam",
        tour_vote_inferred_country: "NL",
        tour_vote_source: "debug",
      },
      groups: [groupId],
      status: "active",
    };

    const response = await fetch(
      "https://connect.mailerlite.com/api/subscribers",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const responseText = await response.text();

    return NextResponse.json({
      ok: response.ok,
      status: response.status,
      groupId,
      payload,
      response: responseText,
    });
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