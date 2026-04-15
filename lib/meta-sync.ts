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

export async function syncMetaDailyToDb() {
  const syncLog = await prisma.syncLog.create({
    data: {
      domain: "meta-daily",
      status: "running",
      message: "Writing today Meta spend to DB",
    },
  });

  try {
    const snapshot = await getMetaSnapshot();

    const spend =
      typeof snapshot?.spend?.today === "number"
        ? snapshot.spend.today
        : 0;

    const purchases =
      typeof snapshot?.salesTrackedToday === "number"
        ? snapshot.salesTrackedToday
        : 0;

    const date = getAmsterdamStartOfDay();

    await prisma.metaDaily.upsert({
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
        message: `Saved today Meta spend: ${spend}`,
        finishedAt: new Date(),
      },
    });

    return { ok: true, spend };
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