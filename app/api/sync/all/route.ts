import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import {
  syncShopifyOrdersToDb,
  syncShopifyCustomersToDb,
} from "@/lib/shopify-sync";
import { syncMetaDailyToDb } from "@/lib/meta-sync";

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
    const [shopifyOrdersResult, shopifyCustomersResult, metaResult] =
      await Promise.all([
        timedStep("syncShopifyOrdersToDb", () => syncShopifyOrdersToDb(2)),
        timedStep("syncShopifyCustomersToDb", () => syncShopifyCustomersToDb(2)),
        timedStep("syncMetaDailyToDb", () => syncMetaDailyToDb()),
      ]);

    const syncLogStartedAt = Date.now();

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
      `[SYNC PERF] prisma.syncLog.create(success): ${Date.now() - syncLogStartedAt}ms`
    );
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

    const syncLogStartedAt = Date.now();

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

    console.log(
      `[SYNC PERF] prisma.syncLog.create(error): ${Date.now() - syncLogStartedAt}ms`
    );
    console.log(
      `[SYNC PERF] /api/sync/all POST total before error response: ${Date.now() - requestStartedAt}ms`
    );

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