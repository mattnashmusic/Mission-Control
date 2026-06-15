import { NextRequest, NextResponse } from "next/server";
import { syncShopifyOrdersToDb } from "@/lib/shopify-sync";

export async function POST(request: NextRequest) {
  try {
    const daysBackParam = request.nextUrl.searchParams.get("daysBack");
    const daysBack = daysBackParam ? Number(daysBackParam) : 2;

    const result = await syncShopifyOrdersToDb(daysBack);

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