import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  syncShopifyOrdersToDb,
  syncShopifyCustomersToDb,
} from "@/lib/shopify-sync";
import { syncMetaDailyToDb } from "@/lib/meta-sync";

export async function POST() {
  const startedAt = new Date();

  try {
    const [shopifyOrdersResult, shopifyCustomersResult, metaResult] =
      await Promise.all([
        syncShopifyOrdersToDb(2),
        syncShopifyCustomersToDb(2),
        syncMetaDailyToDb(),
      ]);

    await prisma.syncLog.create({
      data: {
        domain: "sync-all",
        status: "success",
        message: JSON.stringify({
          shopifyOrdersResult,
          shopifyCustomersResult,
          metaResult,
        }),
        startedAt,
        finishedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      shopifyOrders: shopifyOrdersResult,
      shopifyCustomers: shopifyCustomersResult,
      meta: metaResult,
    });
  } catch (error) {
    console.error("POST /api/sync/all failed:", error);

    await prisma.syncLog.create({
      data: {
        domain: "sync-all",
        status: "error",
        message:
          error instanceof Error ? error.message : "Unknown sync-all error",
        startedAt,
        finishedAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to run full sync",
      },
      { status: 500 }
    );
  }
}