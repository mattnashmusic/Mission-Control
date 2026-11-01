import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import {
  syncShopifyOrdersToDb,
  syncShopifyCustomersToDb,
} from "@/lib/shopify-sync";
import { syncMetaDailyToDb } from "@/lib/meta-sync";
import { getSelfHealingDaysBack } from "@/lib/sync-window";

export const maxDuration = 300;

async function timedStep<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const startedAt = Date.now();

  try {
    const result = await fn();
    console.log(`[SYNC PERF] ${label}: ${Date.now() - startedAt}ms`);
    return result;
  } catch (error) {
    console.error(
      `[SYNC PERF] ${label} failed after ${Date.now() - startedAt}ms`,
      error
    );
    throw error;
  }
}

export async function POST() {
  const startedAt = new Date();
  const requestStartedAt = Date.now();

  console.log("[SYNC PERF] /api/sync/all POST start");

  try {
    // Look back to the last successful sync so missed days get filled in.
    const daysBack = await getSelfHealingDaysBack();

    const [shopifyOrdersResult, shopifyCustomersResult, metaResult] =
      await Promise.all([
        timedStep("syncShopifyOrdersToDb", () => syncShopifyOrdersToDb(daysBack)),
        timedStep("syncShopifyCustomersToDb", () => syncShopifyCustomersToDb(daysBack)),
        timedStep("syncMetaDailyToDb", () => syncMetaDailyToDb()),
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

    console.log(
      `[SYNC PERF] /api/sync/all POST total: ${Date.now() - requestStartedAt}ms`
    );

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