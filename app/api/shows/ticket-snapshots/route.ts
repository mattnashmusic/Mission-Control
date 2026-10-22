import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getMostRecentMondayDate,
  NIJMEGEN_SHOW_SLUG,
  parseSnapshotDateInput,
} from "@/lib/manual-ticket-sales";

type SnapshotBody = {
  showId?: string;
  cumulativeTickets?: number;
  // Optional "YYYY-MM-DD". Defaults to the most recent Monday.
  snapshotDate?: string;
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

    let snapshotDate = getMostRecentMondayDate();
    if (body.snapshotDate !== undefined && body.snapshotDate !== "") {
      const parsed = parseSnapshotDateInput(body.snapshotDate);
      if (!parsed) {
        return NextResponse.json(
          {
            error:
              "Snapshot date must be a valid date after 15 Jun and no later than tomorrow.",
          },
          { status: 400 }
        );
      }
      snapshotDate = parsed;
    }

    const [previousSnapshot, nextSnapshot] = await Promise.all([
      prisma.manualTicketSnapshot.findFirst({
        where: { showId: show.id, snapshotDate: { lt: snapshotDate } },
        orderBy: { snapshotDate: "desc" },
      }),
      prisma.manualTicketSnapshot.findFirst({
        where: { showId: show.id, snapshotDate: { gt: snapshotDate } },
        orderBy: { snapshotDate: "asc" },
      }),
    ]);

    if (
      previousSnapshot &&
      cumulativeTickets < previousSnapshot.cumulativeTickets
    ) {
      return NextResponse.json(
        {
          error: `The cumulative total cannot be lower than the previous snapshot (${previousSnapshot.cumulativeTickets}).`,
        },
        { status: 400 }
      );
    }

    if (nextSnapshot && cumulativeTickets > nextSnapshot.cumulativeTickets) {
      return NextResponse.json(
        {
          error: `The cumulative total cannot be higher than the later snapshot (${nextSnapshot.cumulativeTickets}).`,
        },
        { status: 400 }
      );
    }

    const { snapshot, updatedShow } = await prisma.$transaction(async (tx) => {
      const snapshot = await tx.manualTicketSnapshot.upsert({
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
      });

      // The show total always reflects the latest-dated snapshot, so
      // back-filling an older date doesn't overwrite the current count.
      const latest = await tx.manualTicketSnapshot.findFirst({
        where: { showId: show.id },
        orderBy: { snapshotDate: "desc" },
      });

      const updatedShow = await tx.show.update({
        where: { id: show.id },
        data: { ticketSales: latest?.cumulativeTickets ?? cumulativeTickets },
      });

      return { snapshot, updatedShow };
    });

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
