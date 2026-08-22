import { prisma } from "@/lib/prisma";
import { getEventbriteShowStatsBySlug } from "@/lib/eventbrite";
import {
  buildEstimatedDailyTicketSales,
  NIJMEGEN_SHOW_SLUG,
} from "@/lib/manual-ticket-sales";

// Real per-show ticket totals, using the exact same priority order as the
// Tour tab (app/tour/page.tsx): latest manual snapshot, else live
// Eventbrite count, else the static `ticketSales` field on the Show row.
// Shared so the homepage's Tour card and the Tour tab never disagree on
// what "tickets sold" means.

export type ShowTicketSummary = {
  id: string;
  slug: string;
  date: Date;
  city: string;
  country: string;
  ticketSales: number;
  ticketSalesToday: number;
};

function getAmsterdamDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getUtcDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function getShowsTicketSales(): Promise<ShowTicketSummary[]> {
  const shows = await prisma.show.findMany({
    orderBy: { date: "asc" },
    include: {
      manualTicketSnapshots: {
        orderBy: { snapshotDate: "asc" },
      },
    },
  });

  const now = new Date();
  const amsterdamTodayKey = getAmsterdamDateKey(now);
  const utcTodayKey = getUtcDateKey(now);

  return Promise.all(
    shows.map(async (show) => {
      const isNijmegen = show.slug === NIJMEGEN_SHOW_SLUG;

      const eventbriteStats = isNijmegen
        ? null
        : await getEventbriteShowStatsBySlug(show.slug).catch(() => null);

      const estimatedDailyTicketSales = isNijmegen
        ? buildEstimatedDailyTicketSales(
            show.manualTicketSnapshots,
            show.ticketPrice
          )
        : [];

      const latestManualSnapshot = isNijmegen
        ? show.manualTicketSnapshots.at(-1)
        : null;

      const ticketSales =
        latestManualSnapshot?.cumulativeTickets ??
        eventbriteStats?.ticketSales ??
        show.ticketSales;

      // Eventbrite's daily breakdown is keyed in Amsterdam-local dates
      // (see lib/eventbrite.ts); the manual-snapshot estimate is keyed in
      // UTC dates (see lib/manual-ticket-sales.ts). Match each against its
      // own "today" so a sale right around midnight doesn't get missed or
      // double counted.
      let ticketSalesToday = 0;

      if (isNijmegen) {
        ticketSalesToday =
          estimatedDailyTicketSales.find((point) => point.date === utcTodayKey)
            ?.ticketSales ?? 0;
      } else if (eventbriteStats) {
        ticketSalesToday =
          eventbriteStats.dailyTicketSales.find(
            (point) => point.date === amsterdamTodayKey
          )?.ticketSales ?? 0;
      }

      return {
        id: show.id,
        slug: show.slug,
        date: show.date,
        city: show.city,
        country: show.country,
        ticketSales,
        ticketSalesToday,
      };
    })
  );
}
