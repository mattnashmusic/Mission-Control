import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type TourVoteBody = {
  name?: string;
  email?: string;
  selectedCity?: string;
  selectedCountry?: string;
  inferredCity?: string;
  inferredCountry?: string;
  source?: string;
  eventId?: string;
  pageUrl?: string;
  referrer?: string;
  userAgent?: string;
};

const ALLOWED_ORIGINS = new Set([
  "https://mattnash.com",
  "https://www.mattnash.com",
]);

function buildCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.has(origin)
      ? origin
      : "https://mattnash.com";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  headers: Record<string, string>
) {
  return NextResponse.json(body, {
    status,
    headers,
  });
}

async function pushTourVoteToMailerLite(data: {
  name: string;
  email: string;
  selectedCity?: string;
  selectedCountry?: string;
  inferredCity?: string;
  inferredCountry?: string;
  source?: string;
}) {
  const apiKey = process.env.MAILERLITE_API_KEY;
  const groupId =
    process.env.MAILERLITE_TOUR_VOTE_GROUP_ID;

  if (!apiKey || !groupId) {
    console.error(
      "Missing MailerLite credentials or group ID"
    );
    return;
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

  console.log(
    "Sending subscriber to MailerLite:",
    data.email
  );

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

  if (!response.ok) {
    const errorText = await response.text();

    console.error(
      "MailerLite API error:",
      response.status,
      errorText
    );

    throw new Error(
      `MailerLite sync failed: ${response.status} ${errorText}`
    );
  }

  const responseData = await response.json();

  console.log(
    "MailerLite sync success:",
    data.email,
    responseData?.data?.id ?? "ok"
  );

  return responseData;
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");

  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(origin),
  });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = buildCorsHeaders(origin);

  try {
    const body = (await req.json()) as TourVoteBody;

    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();

    if (!name || !email) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing name or email",
        },
        400,
        headers
      );
    }

    const selectedCity =
      body.selectedCity?.trim() ?? "";
    const selectedCountry =
      body.selectedCountry?.trim() ?? "";
    const inferredCity =
      body.inferredCity?.trim() ?? "";
    const inferredCountry =
      body.inferredCountry?.trim() ?? "";
    const source = body.source?.trim() ?? "tourvote";

    console.log(
      "Creating TourVote entry:",
      email
    );

    const savedVote = await prisma.tourVote.create({
      data: {
        name,
        email,
        selectedCity,
        selectedCountry,
        inferredCity,
        inferredCountry,
        source,
      },
    });

    console.log(
      "TourVote DB save success:",
      email
    );

    try {
      await pushTourVoteToMailerLite({
        name,
        email,
        selectedCity,
        selectedCountry,
        inferredCity,
        inferredCountry,
        source,
      });
    } catch (error) {
      console.error(
        "MailerLite push failed:",
        error
      );
    }

    return jsonResponse(
      {
        ok: true,
        id: savedVote.id,
      },
      200,
      headers
    );
  } catch (error) {
    console.error("TourVote API error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Internal server error",
      },
      500,
      headers
    );
  }
}