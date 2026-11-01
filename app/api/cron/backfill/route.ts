import { NextResponse } from "next/server";
import { backfillMetaDailyToDb } from "@/lib/meta-backfill";
import { prisma } from "@/lib/prisma";
import { isAuthorizedCron } from "@/lib/sync-window";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();

  try {
    const result = await backfillMetaDailyToDb();

    await prisma.syncLog.create({
      data: {
        domain: "cron-backfill",
        status: "success",
        message: JSON.stringify(result),
        startedAt,
        finishedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      result,
    });
  } catch (error) {
    console.error("GET /api/cron/backfill failed:", error);

    await prisma.syncLog.create({
      data: {
        domain: "cron-backfill",
        status: "error",
        message:
          error instanceof Error ? error.message : "Unknown backfill error",
        startedAt,
        finishedAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Cron backfill failed",
      },
      { status: 500 }
    );
  }
}