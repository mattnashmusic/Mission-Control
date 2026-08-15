import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// First-party funnel tracking beacon. Called from a sendBeacon/fetch on the
// actual Shopify bridge pages (Falling, tour show pages, etc.) — no GTM,
// GA4, or Meta involved. Kept deliberately tiny so it never adds load time
// to the page or the CTA click.

const BOT_UA_PATTERN =
  /bot|crawl|spider|slurp|facebookexternalhit|slackbot|discordbot|whatsapp|telegrambot|linkedinbot|pinterest|embedly|quora link preview|outbrain|vkshare|w3c_validator|headless|phantomjs|ahrefsbot|semrushbot|mj12bot|petalbot|bingpreview|google-inspectiontool|adsbot-google/i;

const ALLOWED_SECTIONS = new Set(["release", "tour"]);
const ALLOWED_EVENT_TYPES = new Set(["view", "click"]);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

type TrackBody = {
  section?: unknown;
  pageSlug?: unknown;
  eventType?: unknown;
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: Request) {
  try {
    const userAgent = request.headers.get("user-agent") || "";
    const isBot = BOT_UA_PATTERN.test(userAgent);

    // sendBeacon sends a text/plain body, so we read it as text and parse
    // manually rather than relying on request.json() (which requires an
    // application/json content-type and would also trigger CORS preflight
    // from the browser).
    const raw = await request.text();
    const body: TrackBody = raw ? JSON.parse(raw) : {};

    const section = typeof body.section === "string" ? body.section : "";
    const pageSlug =
      typeof body.pageSlug === "string" ? body.pageSlug.trim().slice(0, 100) : "";
    const eventType = typeof body.eventType === "string" ? body.eventType : "";

    const isValid =
      ALLOWED_SECTIONS.has(section) &&
      ALLOWED_EVENT_TYPES.has(eventType) &&
      pageSlug.length > 0;

    if (isValid && !isBot) {
      await prisma.funnelPageEvent.create({
        data: { section, pageSlug, eventType },
      });
    }

    return NextResponse.json({ ok: true }, { headers: corsHeaders() });
  } catch (error) {
    console.error("POST /api/funnel/track failed:", error);
    // This is a fire-and-forget beacon called from a live bridge page —
    // never surface a hard error back to the page that called it.
    return NextResponse.json(
      { ok: false },
      { status: 200, headers: corsHeaders() }
    );
  }
}
