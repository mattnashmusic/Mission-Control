import { NextResponse } from "next/server";
import { syncShopifyOrdersToDb } from "@/lib/shopify-sync";
import { syncMetaDailyToDb } from "@/lib/meta-sync";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const startedAt = new Date();

  try {
    const [shopifyResult, metaResult] = await Promise.all([
      syncShopifyOrdersToDb(),
      syncMetaDailyToDb(),
    ]);

    await prisma.syncLog.create({
      data: {
        domain: "cron-sync",
        status: "success",
        message: JSON.stringify({
          shopifyResult,
          metaResult,
        }),
        startedAt,
        finishedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      shopify: shopifyResult,
      meta: metaResult,
    });
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