import { NextResponse } from "next/server";
import { syncMetaDailyToDb } from "@/lib/meta-sync";

export async function POST() {
  try {
    const result = await syncMetaDailyToDb();
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/sync/meta failed:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Failed to sync Meta daily data",
      },
      { status: 500 }
    );
  }
}