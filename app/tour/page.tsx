import TourDashboardClient, {
  type TourShow,
} from "@/components/tour/TourDashboardClient";
import { getEventbriteShowStatsBySlug } from "@/lib/eventbrite";
import {
  getTourMetaBudgetsByAdSetId,
  getTourMetaSnapshot,
  resolveTourDailyBudget,
  type TourMetaBudgetResult,
} from "@/lib/meta-tour";
import { prisma } from "@/lib/prisma";
import { TOUR_META_CAMPAIGN_IDS_BY_SLUG } from "@/lib/tour-show-meta-campaigns";
import {
  buildEstimatedDailyTicketSales,
  NIJMEGEN_SHOW_SLUG,
} from "@/lib/manual-ticket-sales";

export default async function TourPage() {
  const [shows, settings] = await Promise.all([
    prisma.show.findMany({
      orderBy: { date: "asc" },
      include: {
        manualTicketSnapshots: {
          orderBy: { snapshotDate: "asc" },
        },
      },
    }),
    prisma.tourSettings.findUnique({
      where: { id: "main" },
    }),
  ]);

  const mappedMetaAdSetIds = Object.values(TOUR_META_CAMPAIGN_IDS_BY_SLUG);
  let metaBudgetsByAdSetId: Record<string, TourMetaBudgetResult> = {};

  try {
    metaBudgetsByAdSetId = await getTourMetaBudgetsByAdSetId(mappedMetaAdSetIds);
  } catch (error) {
    console.error(
      "Failed to load Meta daily budgets; using manual fallbacks where available:",
      error instanceof Error ? error.message : "Unknown Meta error"
    );
  }

  const initialShows: TourShow[] = await Promise.all(
    shows.map(async (show: (typeof shows)[number]) => {
      const isNijmegen = show.slug === NIJMEGEN_SHOW_SLUG;
      const eventbriteStats = isNijmegen
        ? null
        : await getEventbriteShowStatsBySlug(show.slug);
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

      const metaAdSetId = TOUR_META_CAMPAIGN_IDS_BY_SLUG[show.slug];

      let liveMetaSpend = show.metaSpend;

      if (metaAdSetId) {
        try {
          const metaSnapshot = await getTourMetaSnapshot(metaAdSetId);
          liveMetaSpend = metaSnapshot.spend.lifetime;
        } catch (error) {
          console.error(`Failed to load Meta spend for ${show.slug}:`, error);
        }
      }

      const resolvedDailyBudget = resolveTourDailyBudget(
        metaAdSetId ? metaBudgetsByAdSetId[metaAdSetId] ?? null : null,
        show.dailyAdBudget
      );

      return {
        id: show.id,
        slug: show.slug,
        date: show.date.toISOString(),
        city: show.city,
        country: show.country,
        venue: show.venue,
        capacity: show.capacity,
        ticketPrice: show.ticketPrice,
        ticketSales,
        ticketRevenue:
          eventbriteStats?.ticketRevenue ?? ticketSales * show.ticketPrice,
        dailyTicketSales: isNijmegen
          ? estimatedDailyTicketSales
          : eventbriteStats?.dailyTicketSales ?? [],
        metaSpend: liveMetaSpend,
        dailyAdBudget: show.dailyAdBudget,
        projectionDailyBudget: resolvedDailyBudget.dailyBudget,
        dailyBudgetSource: resolvedDailyBudget.source,
        dailyBudgetReason: resolvedDailyBudget.reason,
        matchedMetaAdSets: resolvedDailyBudget.adSets,
        notes: show.notes,
        costs: {
          venueHire: show.venueHire,
          production: show.production,
          hotelPetrolMisc: show.hotelPetrolMisc,
        },
      };
    })
  );

  return (
    <TourDashboardClient
      initialShows={initialShows}
      initialSettings={{
        plannedAdBudget: settings?.plannedAdBudget ?? 12000,
        blendedCpt: settings?.blendedCpt ?? 8,
      }}
    />
  );
}
