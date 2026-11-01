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

// Nightly scheduled sync (see vercel.json). Self-healing:
// - Shopify orders/customers look back to the last successful sync, so
//   missed days get filled in automatically.
// - Meta re-pulls final daily totals for every completed day, then today.
// vercel.json schedules this at 21:59 and 22:59 UTC with ?ams=23 so it runs
// at 23:59 Amsterdam time year-round (CET and CEST); the other slot skips.
function amsterdamHour() {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Amsterdam",
      hour: "2-digit",
      hour12: false,
    }).format(new Date())
  );
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const requiredHour = new URL(request.url).searchParams.get("ams");
  if (requiredHour !== null && amsterdamHour() !== Number(requiredHour)) {
    return NextResponse.json({ ok: true, skipped: "not 23:xx in Amsterdam" });
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
