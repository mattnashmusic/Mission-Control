import { prisma } from "@/lib/prisma";

export async function syncMetaDailyToDb() {
  const syncLog = await prisma.syncLog.create({
    data: {
      domain: "meta-daily",
      status: "running",
      message:
        "Meta daily sync skipped for current day; live Meta is handled separately",
    },
  });

  try {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "success",
        message: "Skipped writing current-day Meta snapshot to MetaDaily",
        finishedAt: new Date(),
      },
    });

    return {
      ok: true,
      skipped: true,
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