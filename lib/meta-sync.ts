import { prisma } from "@/lib/prisma";
import { getMetaSnapshot } from "@/lib/meta";

function getAmsterdamDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getMetaDailyRowDate(date: Date) {
  const dateKey = getAmsterdamDateKey(date);
  return new Date(`${dateKey}T00:00:00.000Z`);
}

function resolveLiveMeta(meta: unknown) {
  const value = meta as
    | {
        spend?: { today?: number };
        dailyBudget?: number | null;
        salesTrackedToday?: number;
        trackedConversions?: number;
        budget?: number | null;
        todaySpend?: number;
      }
    | undefined;

  const spendToday =
    typeof value?.spend?.today === "number"
      ? value.spend.today
      : typeof value?.todaySpend === "number"
      ? value.todaySpend
      : 0;

  const salesTrackedToday =
    typeof value?.salesTrackedToday === "number"
      ? value.salesTrackedToday
      : typeof value?.trackedConversions === "number"
      ? value.trackedConversions
      : 0;

  const dailyBudget =
    typeof value?.dailyBudget === "number"
      ? value.dailyBudget
      : typeof value?.budget === "number"
      ? value.budget
      : null;

  return {
    spendToday,
    salesTrackedToday,
    dailyBudget,
  };
}

export async function syncMetaDailyToDb() {
  const syncLog = await prisma.syncLog.create({
    data: {
      domain: "meta-daily",
      status: "running",
      message: "Fetching live Meta snapshot and writing today into MetaDaily",
    },
  });

  try {
    const snapshot = await getMetaSnapshot();
    const liveMeta = resolveLiveMeta(snapshot);
    const rowDate = getMetaDailyRowDate(new Date());

    const saved = await prisma.metaDaily.upsert({
      where: { date: rowDate },
      update: {
        spend: liveMeta.spendToday,
        purchases: liveMeta.salesTrackedToday,
        syncedAt: new Date(),
      },
      create: {
        date: rowDate,
        spend: liveMeta.spendToday,
        purchases: liveMeta.salesTrackedToday,
        syncedAt: new Date(),
      },
    });

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "success",
        message: JSON.stringify({
          ok: true,
          date: rowDate.toISOString(),
          spend: saved.spend,
          purchases: saved.purchases,
          dailyBudget: liveMeta.dailyBudget,
        }),
        finishedAt: new Date(),
      },
    });

    return {
      ok: true,
      date: rowDate.toISOString(),
      spend: saved.spend,
      purchases: saved.purchases,
      dailyBudget: liveMeta.dailyBudget,
    };
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "error",
        message:
          error instanceof Error ? error.message : "Unknown Meta sync error",
        finishedAt: new Date(),
      },
    });

    throw error;
  }
}