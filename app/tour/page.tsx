import TourDashboardClient, {
  type TourShow,
} from "@/components/tour/TourDashboardClient";
import { prisma } from "@/lib/prisma";

export default async function TourPage() {
  const [shows, settings] = await Promise.all([
    prisma.show.findMany({
      orderBy: { date: "asc" },
    }),
    prisma.tourSettings.findUnique({
      where: { id: "main" },
    }),
  ]);

  const initialShows: TourShow[] = shows.map((show: (typeof shows)[number]) => ({
    id: show.id,
    slug: show.slug,
    date: show.date.toISOString(),
    city: show.city,
    country: show.country,
    venue: show.venue,
    capacity: show.capacity,
    ticketPrice: show.ticketPrice,
    ticketSales: show.ticketSales,
    metaSpend: show.metaSpend,
    notes: show.notes,
    costs: {
      venueHire: show.venueHire,
      production: show.production,
      hotelPetrolMisc: show.hotelPetrolMisc,
    },
  }));

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