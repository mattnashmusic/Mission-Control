import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type PatchBody = {
  id?: string;
  capacity?: number;
  ticketPrice?: number;
  ticketSales?: number;
  metaSpend?: number;
  venueHire?: number;
  production?: number;
  hotelPetrolMisc?: number;
};

const ALLOWED_FIELDS = new Set([
  "capacity",
  "ticketPrice",
  "ticketSales",
  "metaSpend",
  "venueHire",
  "production",
  "hotelPetrolMisc",
]);

function parseNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;

  const num = Number(value);
  if (Number.isNaN(num)) return undefined;

  return num;
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as PatchBody;

    if (!body.id) {
      return NextResponse.json({ error: "Missing show id." }, { status: 400 });
    }

    const data: Record<string, number> = {};

    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_FIELDS.has(key)) continue;

      const parsed = parseNumber(value);
      if (parsed !== undefined) {
        data[key] = parsed;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields provided." },
        { status: 400 }
      );
    }

    const updated = await prisma.show.update({
      where: { id: body.id },
      data,
    });

    return NextResponse.json({ ok: true, show: updated });
  } catch (error) {
    console.error("PATCH /api/shows failed:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update show.",
      },
      { status: 500 }
    );
  }
}