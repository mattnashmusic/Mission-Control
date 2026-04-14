import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";

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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sha256(value: string): string {
  return crypto
    .createHash("sha256")
    .update(value.trim().toLowerCase())
    .digest("hex");
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }

  return "";
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
    const pageUrl = body.pageUrl?.trim() || "https://mattnash.com/pages/tourvote";
    const referrer = body.referrer?.trim() || "";
    const userAgent = body.userAgent?.trim() || req.headers.get("user-agent") || "";

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

    const MAILERLITE_API_KEY = process.env.MAILERLITE_API_KEY;
    const MAILERLITE_GROUP_ID = process.env.MAILERLITE_GROUP_ID;
    const META_PIXEL_ID = process.env.META_PIXEL_ID;
    const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

    if (!MAILERLITE_API_KEY) {
      return jsonResponse(
        { ok: false, error: "Missing MAILERLITE_API_KEY" },
        500,
        headers
      );
    }

    if (!MAILERLITE_GROUP_ID) {
      return jsonResponse(
        { ok: false, error: "Missing MAILERLITE_GROUP_ID" },
        500,
        headers
      );
    }

    if (!META_PIXEL_ID) {
      return jsonResponse(
        { ok: false, error: "Missing META_PIXEL_ID" },
        500,
        headers
      );
    }

    if (!META_ACCESS_TOKEN) {
      return jsonResponse(
        { ok: false, error: "Missing META_ACCESS_TOKEN" },
        500,
        headers
      );
    }

    // 1) Save vote in Mission Control DB
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
    });

    // 2) Upsert subscriber in MailerLite
    const mailerLiteResponse = await fetch(
      "https://connect.mailerlite.com/api/subscribers",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${MAILERLITE_API_KEY}`,
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
          groups: [MAILERLITE_GROUP_ID],
          status: "active",
        }),
      }
    );

    const mailerLiteJson = await mailerLiteResponse.json().catch(() => ({}));

    if (!mailerLiteResponse.ok) {
      console.error("MailerLite error:", mailerLiteJson);
      return jsonResponse(
        {
          ok: false,
          error: "MailerLite upsert failed",
          details: mailerLiteJson,
        },
        502,
        headers
      );
    }

    // 3) Send Meta CAPI Lead event
    const clientIp = getClientIp(req);
    const eventTime = Math.floor(Date.now() / 1000);

    const metaPayload = {
      data: [
        {
          event_name: "Lead",
          event_time: eventTime,
          action_source: "website",
          event_source_url: pageUrl,
          event_id: eventId,
          user_data: {
            em: [sha256(email)],
            fn: [sha256(name)],
            client_ip_address: clientIp,
            client_user_agent: userAgent,
            country: [sha256(selectedCountry)],
            ct: [sha256(selectedCity)],
          },
          custom_data: {
            content_name: "Tour Vote",
            content_category: "Tour Signup",
            selected_city: selectedCity,
            selected_country: selectedCountry,
            inferred_city: inferredCity,
            inferred_country: inferredCountry,
            source,
            referrer,
          },
        },
      ],
    };

    const metaResponse = await fetch(
      `https://graph.facebook.com/v23.0/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(
        META_ACCESS_TOKEN
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metaPayload),
      }
    );

    const metaJson = await metaResponse.json().catch(() => ({}));

    if (!metaResponse.ok) {
      console.error("Meta CAPI error:", metaJson);
      return jsonResponse(
        {
          ok: false,
          error: "Meta CAPI failed",
          details: metaJson,
        },
        502,
        headers
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
    console.error("Tour vote route error:", error);

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