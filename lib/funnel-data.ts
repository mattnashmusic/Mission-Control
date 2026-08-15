import { prisma } from "@/lib/prisma";

const TIME_ZONE = "Europe/Amsterdam";

export type FunnelSection = "release" | "tour";

export type FunnelDailyPoint = {
  date: string; // YYYY-MM-DD
  views: number;
  clicks: number;
};

export type FunnelPageStats = {
  slug: string;
  name: string;
  views: number;
  clicks: number;
  conversionRate: number; // clicks / views * 100
  daily: FunnelDailyPoint[];
};

function getDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDaysToKey(dateKey: string, days: number) {
  const date = parseDateKey(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetweenKeys(startKey: string, endKey: string) {
  const start = parseDateKey(startKey).getTime();
  const end = parseDateKey(endKey).getTime();
  return Math.floor((end - start) / (1000 * 60 * 60 * 24));
}

export async function getFunnelStatsForSection(
  section: FunnelSection,
  pages: { slug: string; name: string }[]
): Promise<FunnelPageStats[]> {
  if (pages.length === 0) return [];

  const events = await prisma.funnelPageEvent.findMany({
    where: { section },
    select: { pageSlug: true, eventType: true, createdAt: true },
  });

  return pages.map(({ slug, name }) => {
    const pageEvents = events.filter((event) => event.pageSlug === slug);

    const byDate = new Map<string, { views: number; clicks: number }>();

    for (const event of pageEvents) {
      const key = getDateKey(event.createdAt);
      const bucket = byDate.get(key) ?? { views: 0, clicks: 0 };
      if (event.eventType === "view") bucket.views += 1;
      if (event.eventType === "click") bucket.clicks += 1;
      byDate.set(key, bucket);
    }

    const dateKeys = [...byDate.keys()].sort();
    let daily: FunnelDailyPoint[] = [];

    if (dateKeys.length > 0) {
      const firstKey = dateKeys[0];
      const lastKey = dateKeys[dateKeys.length - 1];
      const totalDays = daysBetweenKeys(firstKey, lastKey);

      daily = Array.from({ length: totalDays + 1 }, (_, index) => {
        const date = addDaysToKey(firstKey, index);
        const bucket = byDate.get(date) ?? { views: 0, clicks: 0 };
        return { date, views: bucket.views, clicks: bucket.clicks };
      });
    }

    const views = pageEvents.filter((event) => event.eventType === "view").length;
    const clicks = pageEvents.filter((event) => event.eventType === "click").length;
    const conversionRate = views > 0 ? (clicks / views) * 100 : 0;

    return { slug, name, views, clicks, conversionRate, daily };
  });
}
