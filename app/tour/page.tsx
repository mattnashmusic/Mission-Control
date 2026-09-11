import TourDashboardClient, {
  type TourShow,
} from "@/components/tour/TourDashboardClient";
import { getEventbriteShowStatsBySlug } from "@/lib/eventbrite";
import {
  combineTourMetaBudgets,
  getTourMetaBudgetsByAdSetId,
  getTourMetaSnapshotForAdSets,
  resolveTourDailyBudget,
  type TourMetaBudgetResult,
} from "@/lib/meta-tour";
import { prisma } from "@/lib/prisma";
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
        metaAdSets: {
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.tourSettings.findUnique({
      where: { id: "main" },
    }),
  ]);

  const mappedMetaAdSetIds = shows.flatMap((show) =>
    show.metaAdSets.map((adSet) => adSet.adSetId)
  );
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

      const metaAdSetIds = show.metaAdSets.map((adSet) => adSet.adSetId);

      let liveMetaSpend = show.metaSpend;

      if (metaAdSetIds.length > 0) {
        try {
          const metaSnapshot = await getTourMetaSnapshotForAdSets(metaAdSetIds);
          liveMetaSpend = metaSnapshot.spend.lifetime;
        } catch (error) {
          console.error(`Failed to load Meta spend for ${show.slug}:`, error);
        }
      }

      const combinedBudget =
        metaAdSetIds.length > 0
          ? combineTourMetaBudgets(
              metaAdSetIds
                .map((id) => metaBudgetsByAdSetId[id])
                .filter((result): result is TourMetaBudgetResult =>
                  Boolean(result)
                )
            )
          : null;

      const resolvedDailyBudget = resolveTourDailyBudget(
        combinedBudget,
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
        linkedMetaAdSets: show.metaAdSets.map((adSet) => ({
          id: adSet.id,
          adSetId: adSet.adSetId,
          label: adSet.label,
        })),
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
