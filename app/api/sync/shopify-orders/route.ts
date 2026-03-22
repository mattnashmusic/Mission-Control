import { NextResponse } from "next/server";
import { syncShopifyOrdersToDb } from "@/lib/shopify-sync";

export async function POST() {
  try {
    const result = await syncShopifyOrdersToDb();
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/sync/shopify-orders failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to sync Shopify orders",
      },
      { status: 500 }
    );
  }
}