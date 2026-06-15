import TourDashboardClient, {
  type TourShow,
} from "@/components/tour/TourDashboardClient";
import { getEventbriteShowStatsBySlug } from "@/lib/eventbrite";
import { getTourMetaSnapshot } from "@/lib/meta-tour";
import { prisma } from "@/lib/prisma";
import { TOUR_META_CAMPAIGN_IDS_BY_SLUG } from "@/lib/tour-show-meta-campaigns";

export default async function TourPage() {
  const [shows, settings] = await Promise.all([
    prisma.show.findMany({
      orderBy: { date: "asc" },
    }),
    prisma.tourSettings.findUnique({
      where: { id: "main" },
    }),
  ]);

  const initialShows: TourShow[] = await Promise.all(
    shows.map(async (show: (typeof shows)[number]) => {
      const eventbriteStats = await getEventbriteShowStatsBySlug(show.slug);

      const metaCampaignId = TOUR_META_CAMPAIGN_IDS_BY_SLUG[show.slug];

      let liveMetaSpend = show.metaSpend;

      if (metaCampaignId) {
        try {
          const metaSnapshot = await getTourMetaSnapshot(metaCampaignId);
          liveMetaSpend = metaSnapshot.spend.lifetime;
        } catch (error) {
          console.error(`Failed to load Meta spend for ${show.slug}:`, error);
        }
      }

      return {
        id: show.id,
        slug: show.slug,
        date: show.date.toISOString(),
        city: show.city,
        country: show.country,
        venue: show.venue,
        capacity: show.capacity,
        ticketPrice: show.ticketPrice,
        ticketSales: eventbriteStats?.ticketSales ?? show.ticketSales,
        ticketRevenue:
          eventbriteStats?.ticketRevenue ?? show.ticketSales * show.ticketPrice,
        dailyTicketSales: eventbriteStats?.dailyTicketSales ?? [],
        metaSpend: liveMetaSpend,
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