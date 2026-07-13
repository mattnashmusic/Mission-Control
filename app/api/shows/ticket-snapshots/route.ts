import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getMostRecentMondayDate,
  NIJMEGEN_SHOW_SLUG,
} from "@/lib/manual-ticket-sales";

type SnapshotBody = {
  showId?: string;
  cumulativeTickets?: number;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SnapshotBody;
    const cumulativeTickets = Number(body.cumulativeTickets);

    if (!body.showId) {
      return NextResponse.json({ error: "Missing show id." }, { status: 400 });
    }

    if (!Number.isInteger(cumulativeTickets) || cumulativeTickets < 0) {
      return NextResponse.json(
        { error: "Cumulative tickets must be a non-negative whole number." },
        { status: 400 }
      );
    }

    const show = await prisma.show.findUnique({ where: { id: body.showId } });

    if (!show || show.slug !== NIJMEGEN_SHOW_SLUG) {
      return NextResponse.json(
        { error: "Manual ticket snapshots are only available for Nijmegen." },
        { status: 400 }
      );
    }

    const snapshotDate = getMostRecentMondayDate();
    const previousSnapshot = await prisma.manualTicketSnapshot.findFirst({
      where: {
        showId: show.id,
        snapshotDate: { lt: snapshotDate },
      },
      orderBy: { snapshotDate: "desc" },
    });

    if (
      previousSnapshot &&
      cumulativeTickets < previousSnapshot.cumulativeTickets
    ) {
      return NextResponse.json(
        { error: "The cumulative total cannot be lower than the previous Monday." },
        { status: 400 }
      );
    }

    const [snapshot, updatedShow] = await prisma.$transaction([
      prisma.manualTicketSnapshot.upsert({
        where: {
          showId_snapshotDate: {
            showId: show.id,
            snapshotDate,
          },
        },
        update: { cumulativeTickets },
        create: {
          showId: show.id,
          snapshotDate,
          cumulativeTickets,
        },
      }),
      prisma.show.update({
        where: { id: show.id },
        data: { ticketSales: cumulativeTickets },
      }),
    ]);

    return NextResponse.json({ ok: true, snapshot, show: updatedShow });
  } catch (error) {
    console.error("POST /api/shows/ticket-snapshots failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to save snapshot.",
      },
      { status: 500 }
    );
  }
}
