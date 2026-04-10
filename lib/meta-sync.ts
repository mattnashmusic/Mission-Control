import { prisma } from "@/lib/prisma";
import { getMetaSnapshot } from "@/lib/meta";

function getAmsterdamStartOfDay() {
  const now = new Date();

  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  return new Date(`${dateKey}T00:00:00.000Z`);
}

function resolveMeta(meta: any) {
  const spend =
    typeof meta?.spend?.today === "number"
      ? meta.spend.today
      : typeof meta?.todaySpend === "number"
      ? meta.todaySpend
      : 0;

  const purchases =
    typeof meta?.salesTrackedToday === "number"
      ? meta.salesTrackedToday
      : typeof meta?.trackedConversions === "number"
      ? meta.trackedConversions
      : 0;

  return { spend, purchases };
}

export async function syncMetaDailyToDb() {
  const syncLog = await prisma.syncLog.create({
    data: {
      domain: "meta-daily",
      status: "running",
      message: "Fetching Meta + writing to DB",
    },
  });

  try {
    const snapshot = await getMetaSnapshot();
    const { spend, purchases } = resolveMeta(snapshot);

    const date = getAmsterdamStartOfDay();

    const result = await prisma.metaDaily.upsert({
      where: { date },
      update: {
        spend,
        purchases,
        syncedAt: new Date(),
      },
      create: {
        date,
        spend,
        purchases,
        syncedAt: new Date(),
      },
    });

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "success",
        message: JSON.stringify(result),
        finishedAt: new Date(),
      },
    });

    return { ok: true, spend, purchases };
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "error",
        message:
          error instanceof Error ? error.message : "Meta sync error",
        finishedAt: new Date(),
      },
    });

    throw error;
  }
}