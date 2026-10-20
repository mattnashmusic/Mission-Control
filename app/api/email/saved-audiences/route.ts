import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type CreateBody = {
  name?: string;
  city?: string;
  country?: string | null;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  showId?: string | null;
  refinements?: unknown;
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
    const refinements = sanitizeRefinements(body.refinements);

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
      data: {
        name,
        city,
        country,
        lat,
        lng,
        radiusKm,
        showId,
        refinements: refinements ?? Prisma.DbNull,
      },
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

// Only keep the shape of data the map understands, and cap sizes so a
// runaway lasso can't bloat the row.
function sanitizeRefinements(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;

  const shapes = Array.isArray(input.shapes)
    ? input.shapes
        .slice(0, 50)
        .map((raw) => {
          const shape = raw as Record<string, unknown>;
          const mode = shape.mode === "exclude" ? "exclude" : "include";
          const coordinates = Array.isArray(shape.coordinates)
            ? shape.coordinates
                .slice(0, 2000)
                .filter(
                  (pair): pair is [number, number] =>
                    Array.isArray(pair) &&
                    pair.length === 2 &&
                    Number.isFinite(pair[0]) &&
                    Number.isFinite(pair[1])
                )
            : [];
          return {
            id: String(shape.id ?? "").slice(0, 64) || `shape-${Math.random().toString(36).slice(2)}`,
            mode,
            label: typeof shape.label === "string" ? shape.label.slice(0, 80) : undefined,
            coordinates,
          };
        })
        .filter((shape) => shape.coordinates.length >= 3)
    : [];

  const keys = (list: unknown) =>
    Array.isArray(list)
      ? list.filter((k): k is string => typeof k === "string").slice(0, 2000).map((k) => k.slice(0, 200))
      : [];

  const includeKeys = keys(input.includeKeys);
  const excludeKeys = keys(input.excludeKeys);

  if (shapes.length === 0 && includeKeys.length === 0 && excludeKeys.length === 0) return null;
  return { shapes, includeKeys, excludeKeys };
}
