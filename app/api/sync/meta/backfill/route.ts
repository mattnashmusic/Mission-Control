import { NextResponse } from "next/server";
import { backfillMetaDailyToDb } from "@/lib/meta-backfill";

export async function POST() {
  try {
    const result = await backfillMetaDailyToDb();
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/sync/meta/backfill failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to backfill Meta daily data",
      },
      { status: 500 }
    );
  }
}