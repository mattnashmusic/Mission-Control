import FunnelsDashboardClient from "@/components/funnels/FunnelsDashboardClient";
import { getFunnelStatsForSection } from "@/lib/funnel-data";
import { prisma } from "@/lib/prisma";
import { TOUR_SHOW_PAGE_SLUGS } from "@/lib/funnel-tour-pages";

export default async function FunnelsPage() {
  const [releasePages, shows] = await Promise.all([
    prisma.releasePage.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.show.findMany({
      orderBy: { date: "asc" },
    }),
  ]);

  const releaseTargets = releasePages.map((page) => ({
    slug: page.slug,
    name: page.name,
  }));

  const tourTargets = shows
    .filter((show) => TOUR_SHOW_PAGE_SLUGS[show.slug])
    .map((show) => ({
      slug: TOUR_SHOW_PAGE_SLUGS[show.slug],
      name: show.city,
    }));

  const [releases, tour] = await Promise.all([
    getFunnelStatsForSection("release", releaseTargets),
    getFunnelStatsForSection("tour", tourTargets),
  ]);

  return <FunnelsDashboardClient releases={releases} tour={tour} />;
}
