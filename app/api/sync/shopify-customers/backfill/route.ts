import { NextResponse } from "next/server";
import { backfillShopifyCustomersToDb } from "@/lib/shopify-sync";

export async function POST() {
  try {
    const result = await backfillShopifyCustomersToDb();
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/sync/shopify-customers/backfill failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to backfill Shopify customers",
      },
      { status: 500 }
    );
  }
}