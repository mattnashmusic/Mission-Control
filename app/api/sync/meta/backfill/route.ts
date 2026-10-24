import { NextResponse } from "next/server";
import { backfillMetaDailyToDb } from "@/lib/meta-backfill";

export async function POST(request: Request) {
  try {
    const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
    const result = await backfillMetaDailyToDb({ dryRun });
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