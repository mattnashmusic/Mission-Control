import { after, NextRequest, NextResponse } from "next/server";
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
    origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://mattnash.com";

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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function pushTourVoteToMailerLite({
  name,
  email,
  selectedCity,
  selectedCountry,
  inferredCity,
  inferredCountry,
  source,
}: {
  name: string;
  email: string;
  selectedCity: string;
  selectedCountry: string;
  inferredCity: string;
  inferredCountry: string;
  source: string;
}) {
  const apiKey = process.env.MAILERLITE_API_KEY;
  const groupId = process.env.MAILERLITE_TOUR_VOTE_GROUP_ID;

  if (!apiKey || !groupId) {
    console.error("MailerLite env vars missing");
    return;
  }

  const response = await fetch("https://connect.mailerlite.com/api/subscribers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      email,
      fields: {
        name,
        tour_vote_city: selectedCity,
        tour_vote_country: selectedCountry,
        tour_vote_inferred_city: inferredCity,
        tour_vote_inferred_country: inferredCountry,
        tour_vote_source: source,
      },
      groups: [Number(groupId)],
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    console.error("MailerLite API error:", response.status, responseText);
    return;
  }

  console.log("MailerLite tour vote synced:", response.status, email);
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = buildCorsHeaders(origin);

  return new NextResponse(null, {
    status: 204,
    headers,
  });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = buildCorsHeaders(origin);

  try {
    const body = (await req.json()) as TourVoteBody;

    const name = body.name?.trim() || "";
    const email = body.email?.trim() || "";
    const selectedCity = body.selectedCity?.trim() || "";
    const selectedCountry = body.selectedCountry?.trim() || "";
    const inferredCity = body.inferredCity?.trim() || "";
    const inferredCountry = body.inferredCountry?.trim() || "";
    const source = body.source?.trim() || "tourvote";
    const eventId = body.eventId?.trim() || "";

    if (!name || !email || !selectedCity || !selectedCountry || !eventId) {
      return jsonResponse(
        { ok: false, error: "Missing required fields" },
        400,
        headers
      );
    }

    if (!isValidEmail(email)) {
      return jsonResponse(
        { ok: false, error: "Invalid email address" },
        400,
        headers
      );
    }

    try {
      const savedVote = await prisma.tourVote.create({
        data: {
          name,
          email,
          selectedCity,
          selectedCountry,
          inferredCity: inferredCity || null,
          inferredCountry: inferredCountry || null,
          source,
        },
        select: {
          id: true,
        },
      });

      after(() => {
        pushTourVoteToMailerLite({
          name,
          email,
          selectedCity,
          selectedCountry,
          inferredCity,
          inferredCountry,
          source,
        }).catch((error) => {
          console.error("MailerLite push failed:", error);
        });
      });

      return jsonResponse(
        {
          ok: true,
          id: savedVote.id,
        },
        200,
        headers
      );
    } catch (error) {
      console.error("Tour vote DB error:", error);

      return jsonResponse(
        {
          ok: false,
          error: "DB write failed",
          details: getErrorMessage(error),
        },
        500,
        headers
      );
    }
  } catch (error) {
    console.error("Tour vote route fatal error:", error);

    return jsonResponse(
      {
        ok: false,
        error: "Internal server error",
        details: getErrorMessage(error),
      },
      500,
      headers
    );
  }
}