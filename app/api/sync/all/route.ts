import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncShopifyOrdersToDb } from "@/lib/shopify-sync";
import { syncMetaDailyToDb } from "@/lib/meta-sync";

export async function POST() {
  const startedAt = new Date();

  try {
    const [shopifyResult, metaResult] = await Promise.all([
      syncShopifyOrdersToDb(),
      syncMetaDailyToDb(),
    ]);

    await prisma.syncLog.create({
      data: {
        domain: "sync-all",
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