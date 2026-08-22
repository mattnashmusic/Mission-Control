import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type CreateBody = {
  name?: string;
  city?: string;
  country?: string | null;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  showId?: string | null;
};

type DeleteBody = {
  id?: string;
};

export async function GET() {
  try {
    const audiences = await prisma.savedAudience.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ audiences });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load saved audiences";
    return new NextResponse(message, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CreateBody;

    const name = (body.name ?? "").trim().slice(0, 255);
    const city = (body.city ?? "").trim();
    const country = body.country?.trim() || null;
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const radiusKm = Number(body.radiusKm);
    const showId = body.showId?.trim() || null;

    if (!name) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }
    if (!city) {
      return NextResponse.json({ error: "City is required." }, { status: 400 });
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: "Valid coordinates are required." }, { status: 400 });
    }
    if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
      return NextResponse.json({ error: "A positive radius is required." }, { status: 400 });
    }

    const audience = await prisma.savedAudience.create({
      data: { name, city, country, lat, lng, radiusKm, showId },
    });

    return NextResponse.json({ audience });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save audience";
    return new NextResponse(message, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as DeleteBody;

    if (!body.id) {
      return NextResponse.json({ error: "Missing audience id." }, { status: 400 });
    }

    await prisma.savedAudience.delete({ where: { id: body.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete audience";
    return new NextResponse(message, { status: 500 });
  }
}
