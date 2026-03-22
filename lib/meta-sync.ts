import { prisma } from "@/lib/prisma";
import { getMetaSnapshot } from "@/lib/meta";

const TIME_ZONE = "Europe/Amsterdam";

function startOfLocalDay(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
}

export async function syncMetaDailyToDb() {
  const syncLog = await prisma.syncLog.create({
    data: {
      domain: "meta-daily",
      status: "running",
      message: "Starting Meta daily sync",
    },
  });

  try {
    const meta = await getMetaSnapshot();
    const today = startOfLocalDay(new Date());

    const result = await prisma.metaDaily.upsert({
      where: { date: today },
      update: {
        spend: meta.spend.today,
        purchases: meta.salesTrackedToday,
        syncedAt: new Date(),
      },
      create: {
        date: today,
        spend: meta.spend.today,
        purchases: meta.salesTrackedToday,
        syncedAt: new Date(),
      },
    });

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "success",
        message: `Synced Meta daily row for ${today.toISOString().slice(0, 10)}`,
        finishedAt: new Date(),
      },
    });

    return {
      ok: true,
      date: result.date,
      spend: result.spend,
      purchases: result.purchases,
    };
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown Meta sync error",
        finishedAt: new Date(),
      },
    });

    throw error;
  }
}