import { prisma } from "@/lib/prisma";

const FULL_SYNC_DOMAINS = ["sync-all", "cron-sync"];
const MIN_DAYS_BACK = 2;
const MAX_DAYS_BACK = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How far back the Shopify sync needs to look so that no day is skipped.
 * Covers everything since the last successful full sync (manual or cron),
 * plus a 1-day buffer for late edits/timezone edges. Never less than 2 days.
 */
export async function getSelfHealingDaysBack() {
  const lastSuccess = await prisma.syncLog.findFirst({
    where: { domain: { in: FULL_SYNC_DOMAINS }, status: "success" },
    orderBy: { startedAt: "desc" },
    select: { startedAt: true },
  });

  if (!lastSuccess) return MAX_DAYS_BACK;

  const daysSince = Math.ceil(
    (Date.now() - lastSuccess.startedAt.getTime()) / DAY_MS
  );

  return Math.min(MAX_DAYS_BACK, Math.max(MIN_DAYS_BACK, daysSince + 1));
}

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when that env var is set. */
export function isAuthorizedCron(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}
