import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type PostBody = {
  showId?: string;
  adSetId?: string;
  label?: string | null;
};

type DeleteBody = {
  id?: string;
};

function cleanAdSetId(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PostBody;

    if (!body.showId) {
      return NextResponse.json({ error: "Missing show id." }, { status: 400 });
    }

    const adSetId = cleanAdSetId(body.adSetId);
    if (!adSetId) {
      return NextResponse.json(
        { error: "Missing Meta ad set ID." },
        { status: 400 }
      );
    }

    const show = await prisma.show.findUnique({ where: { id: body.showId } });
    if (!show) {
      return NextResponse.json({ error: "Show not found." }, { status: 404 });
    }

    const label =
      typeof body.label === "string" && body.label.trim().length > 0
        ? body.label.trim()
        : null;

    const created = await prisma.showMetaAdSet.upsert({
      where: {
        showId_adSetId: {
          showId: show.id,
          adSetId,
        },
      },
      update: { label },
      create: {
        showId: show.id,
        adSetId,
        label,
      },
    });

    return NextResponse.json({ ok: true, adSet: created });
  } catch (error) {
    console.error("POST /api/shows/meta-ad-sets failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to link ad set.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as DeleteBody;

    if (!body.id) {
      return NextResponse.json({ error: "Missing ad set link id." }, {
        status: 400,
      });
    }

    await prisma.showMetaAdSet.delete({ where: { id: body.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/shows/meta-ad-sets failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to unlink ad set.",
      },
      { status: 500 }
    );
  }
}
