import { NextResponse } from "next/server";
import {
  syncShopifyOrdersToDb,
  syncShopifyCustomersToDb,
} from "@/lib/shopify-sync";
import { syncMetaDailyToDb } from "@/lib/meta-sync";
import { backfillMetaDailyToDb } from "@/lib/meta-backfill";
import { getSelfHealingDaysBack, isAuthorizedCron } from "@/lib/sync-window";
import { prisma } from "@/lib/prisma";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Daily scheduled sync (see vercel.json). Self-healing:
// - Shopify orders/customers look back to the last successful sync, so
//   missed days get filled in automatically.
// - Meta re-pulls final daily totals for every completed day, then today.
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date();

  try {
    const daysBack = await getSelfHealingDaysBack();

    const [shopifyOrders, shopifyCustomers, meta] = await Promise.all([
      syncShopifyOrdersToDb(daysBack),
      syncShopifyCustomersToDb(daysBack),
      (async () => {
        const backfill = await backfillMetaDailyToDb();
        const today = await syncMetaDailyToDb();
        return { backfill, today };
      })(),
    ]);

    const result = { daysBack, shopifyOrders, shopifyCustomers, meta };

    await prisma.syncLog.create({
      data: {
        domain: "cron-sync",
        status: "success",
        message: JSON.stringify(result),
        startedAt,
        finishedAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("GET /api/cron/sync failed:", error);

    await prisma.syncLog.create({
      data: {
        domain: "cron-sync",
        status: "error",
        message: error instanceof Error ? error.message : "Unknown cron error",
        startedAt,
        finishedAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Cron sync failed",
      },
      { status: 500 }
    );
  }
}
