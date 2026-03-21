import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type PatchBody = {
  plannedAdBudget?: number;
  blendedCpt?: number;
};

function parseNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;

  const num = Number(value);
  if (Number.isNaN(num)) return undefined;

  return num;
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as PatchBody;

    const data: {
      plannedAdBudget?: number;
      blendedCpt?: number;
    } = {};

    const plannedAdBudget = parseNumber(body.plannedAdBudget);
    const blendedCpt = parseNumber(body.blendedCpt);

    if (plannedAdBudget !== undefined) {
      data.plannedAdBudget = plannedAdBudget;
    }

    if (blendedCpt !== undefined) {
      data.blendedCpt = blendedCpt;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid settings provided." },
        { status: 400 }
      );
    }

    const settings = await prisma.tourSettings.upsert({
      where: { id: "main" },
      update: data,
      create: {
        id: "main",
        plannedAdBudget: data.plannedAdBudget ?? 12000,
        blendedCpt: data.blendedCpt ?? 8,
      },
    });

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    console.error("PATCH /api/tour-settings failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update tour settings.",
      },
      { status: 500 }
    );
  }
}