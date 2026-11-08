import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

// Rebirth Tour Part 2 city registration pages post here.
// Kept fully separate from /api/tourvote: own table (TourRegistration)
// and own MailerLite group (MAILERLITE_REBIRTH_P2_GROUP_ID).

type RegistrationBody = {
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

function clean(value: string | undefined, max = 500) {
  return (value ?? "").trim().slice(0, max);
}

function getClientIp(req: NextRequest) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || null;
}

async function pushToMailerLite(data: {
  name: string;
  email: string;
  city: string;
  country: string;
  source: string;
  inferredCity: string;
  inferredCountry: string;
}) {
  const apiKey = process.env.MAILERLITE_API_KEY;
  const groupId = process.env.MAILERLITE_REBIRTH_P2_GROUP_ID;

  if (!apiKey || !groupId) {
    return {
      status: "skipped",
      error: "MAILERLITE_API_KEY or MAILERLITE_REBIRTH_P2_GROUP_ID not set",
    };
  }

  const response = await fetch(
    "https://connect.mailerlite.com/api/subscribers",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email: data.email,
        fields: {
          name: data.name,
          registration_city: data.city,
          registration_country: data.country,
          registration_source: data.source,
          registration_inferred_city: data.inferredCity,
          registration_inferred_country: data.inferredCountry,
        },
        groups: [groupId],
        status: "active",
      }),
    }
  );

  if (response.ok) return { status: "ok", error: null };

  const text = await response.text();
  return { status: "error", error: `${response.status}: ${text.slice(0, 500)}` };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: buildCorsHeaders(req.headers.get("origin")),
  });
}

export async function POST(req: NextRequest) {
  const headers = buildCorsHeaders(req.headers.get("origin"));

  try {
    const body = (await req.json()) as RegistrationBody;

    const name = clean(body.name, 200);
    const email = clean(body.email, 320).toLowerCase();
    const city = clean(body.selectedCity, 100);
    const country = clean(body.selectedCountry, 10);
    const source = clean(body.source, 100);
    const inferredCity = clean(body.inferredCity, 100);
    const inferredCountry = clean(body.inferredCountry, 10);

    if (!name || !email || !email.includes("@")) {
      return NextResponse.json(
        { ok: false, error: "Missing name or email" },
        { status: 400, headers }
      );
    }

    if (!city || !source) {
      return NextResponse.json(
        { ok: false, error: "Missing city or source" },
        { status: 400, headers }
      );
    }

    const saved = await prisma.tourRegistration.create({
      data: {
        name,
        email,
        city,
        country,
        source,
        inferredCity: inferredCity || null,
        inferredCountry: inferredCountry || null,
        eventId: clean(body.eventId, 200) || null,
        ipAddress: getClientIp(req),
        userAgent:
          clean(body.userAgent, 1000) ||
          req.headers.get("user-agent") ||
          null,
        pageUrl: clean(body.pageUrl, 1000) || null,
        referrer: clean(body.referrer, 1000) || null,
      },
    });

    let mailerlite: { status: string; error: string | null };

    try {
      mailerlite = await pushToMailerLite({
        name,
        email,
        city,
        country,
        source,
        inferredCity,
        inferredCountry,
      });
    } catch (error) {
      mailerlite = {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown MailerLite error",
      };
    }

    try {
      await prisma.tourRegistration.update({
        where: { id: saved.id },
        data: {
          mailerliteStatus: mailerlite.status,
          mailerliteError: mailerlite.error,
        },
      });
    } catch (error) {
      console.error("Registration MailerLite status update failed:", error);
    }

    return NextResponse.json({ ok: true, id: saved.id }, { status: 200, headers });
  } catch (error) {
    console.error("Registration API error:", error);

    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500, headers }
    );
  }
}
