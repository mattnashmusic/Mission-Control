import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function pushToMailerLite(data: {
  name: string;
  email: string;
  selectedCity?: string;
  selectedCountry?: string;
  inferredCity?: string;
  inferredCountry?: string;
  source?: string;
}) {
  const apiKey = process.env.MAILERLITE_API_KEY;
  const groupId = process.env.MAILERLITE_TOUR_VOTE_GROUP_ID;

  if (!apiKey || !groupId) {
    throw new Error("Missing MailerLite credentials or group ID");
  }

  const payload = {
    email: data.email,
    fields: {
      name: data.name,
      tour_vote_city: data.selectedCity ?? "",
      tour_vote_country: data.selectedCountry ?? "",
      tour_vote_inferred_city: data.inferredCity ?? "",
      tour_vote_inferred_country: data.inferredCountry ?? "",
      tour_vote_source: data.source ?? "tourvote",
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

  const text = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    response: text,
  };
}

export async function GET(req: NextRequest) {
  try {
    const limit = Number(req.nextUrl.searchParams.get("limit")) || 25;
    const skip = Number(req.nextUrl.searchParams.get("skip")) || 0;

    const rows = await prisma.tourVote.findMany({
      orderBy: {
        createdAt: "asc",
      },
      skip,
      take: limit,
    });

    const results = [];

    for (const row of rows) {
      try {
        const result = await pushToMailerLite({
          name: row.name,
          email: row.email,
          selectedCity: row.selectedCity ?? "",
          selectedCountry: row.selectedCountry ?? "",
          inferredCity: row.inferredCity ?? "",
          inferredCountry: row.inferredCountry ?? "",
          source: row.source ?? "tourvote",
        });

        results.push({
          email: row.email,
          ok: result.ok,
          status: result.status,
        });

        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error) {
        results.push({
          email: row.email,
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      skip,
      limit,
      processed: results.length,
      results,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error:
        error instanceof Error ? error.message : "Unknown error",
    });
  }
}