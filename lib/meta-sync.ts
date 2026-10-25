import { prisma } from "@/lib/prisma";
import {
  getMetaPurchasesForDatePreset,
  getMetaSnapshot,
} from "@/lib/meta";

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

    // Also lock in yesterday's final numbers. Otherwise yesterday keeps
    // whatever partial value the last same-day sync happened to capture
    // (or is missing entirely if no sync ran that day).
    const yesterdayDate = new Date(date);
    yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
    const yesterdayPurchases = await getMetaPurchasesForDatePreset("yesterday");
    await prisma.metaDaily.upsert({
      where: { date: yesterdayDate },
      update: {
        spend: snapshot.spend.yesterday,
        purchases: yesterdayPurchases,
        syncedAt: new Date(),
      },
      create: {
        date: yesterdayDate,
        spend: snapshot.spend.yesterday,
        purchases: yesterdayPurchases,
        syncedAt: new Date(),
      },
    });

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