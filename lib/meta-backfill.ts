import { prisma } from "@/lib/prisma";

const META_API_VERSION = "v25.0";
const FSH_START_DATE = "2026-02-12";
const TIME_ZONE = "Europe/Amsterdam";

type MetaInsightsRow = {
  date_start: string;
  date_stop?: string;
  spend?: string;
  actions?: Array<{
    action_type: string;
    value: string;
  }>;
};

type MetaInsightsResponse = {
  data?: MetaInsightsRow[];
  paging?: {
    next?: string;
  };
};

function getMetaEnv() {
  const accessToken =
    process.env.META_ACCESS_TOKEN ||
    process.env.FACEBOOK_ACCESS_TOKEN ||
    process.env.META_TOKEN;

  const campaignId = process.env.META_CAMPAIGN_ID;

  if (!accessToken || !campaignId) {
    throw new Error("Missing META_ACCESS_TOKEN or META_CAMPAIGN_ID.");
  }

  return {
    accessToken,
    campaignId,
  };
}

function startOfUtcDayFromDateString(dateString: string) {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function formatUtcDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getLocalDateString(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getYesterdayLocalDateString() {
  const now = new Date();
  const localNow = new Date(
    now.toLocaleString("en-US", { timeZone: TIME_ZONE })
  );
  localNow.setDate(localNow.getDate() - 1);
  return getLocalDateString(localNow);
}

function actionSafeValue(value: string | undefined) {
  if (!value) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function getPurchaseCountFromActions(
  actions: MetaInsightsRow["actions"] | undefined
) {
  if (!actions || actions.length === 0) return 0;

  const purchaseAction = actions.find(
    (action) =>
      action.action_type === "purchase" ||
      action.action_type === "omni_purchase" ||
      action.action_type === "offsite_conversion.fb_pixel_purchase"
  );

  return purchaseAction ? Number(actionSafeValue(purchaseAction.value)) : 0;
}

function buildDateRange(startDate: string, endDate: string) {
  const dates: string[] = [];
  const current = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  while (current <= end) {
    dates.push(formatUtcDate(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

async function fetchAllMetaInsightsRows(untilDate: string) {
  const { accessToken, campaignId } = getMetaEnv();

  const params = new URLSearchParams({
    fields: "spend,actions,date_start,date_stop",
    time_increment: "1",
    time_range: JSON.stringify({
      since: FSH_START_DATE,
      until: untilDate,
    }),
    limit: "500",
    access_token: accessToken,
  });

  let url = `https://graph.facebook.com/${META_API_VERSION}/${campaignId}/insights?${params.toString()}`;
  const allRows: MetaInsightsRow[] = [];

  while (url) {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Meta backfill fetch failed: ${response.status} ${text}`);
    }

    const json = (await response.json()) as MetaInsightsResponse;
    const rows = json.data ?? [];
    allRows.push(...rows);
    url = json.paging?.next ?? "";
  }

  return allRows;
}

export async function backfillMetaDailyToDb() {
  const yesterdayString = getYesterdayLocalDateString();

  const syncLog = await prisma.syncLog.create({
    data: {
      domain: "meta-daily-backfill",
      status: "running",
      message: `Backfilling Meta campaign data from ${FSH_START_DATE} to ${yesterdayString}`,
    },
  });

  try {
    if (yesterdayString < FSH_START_DATE) {
      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: "success",
          message: "No completed days available to backfill yet",
          finishedAt: new Date(),
        },
      });

      return {
        ok: true,
        rowsFetchedFromApi: 0,
        totalDaysCovered: 0,
        rowsUpserted: 0,
      };
    }

    const rows = await fetchAllMetaInsightsRows(yesterdayString);

    const rowMap = new Map<
      string,
      {
        spend: number;
        purchases: number;
      }
    >();

    for (const row of rows) {
      rowMap.set(row.date_start, {
        spend: Number(row.spend ?? 0),
        purchases: getPurchaseCountFromActions(row.actions),
      });
    }

    const allDates = buildDateRange(FSH_START_DATE, yesterdayString);
    let upserted = 0;

    for (const dateString of allDates) {
      const existing = rowMap.get(dateString);
      const date = startOfUtcDayFromDateString(dateString);

      await prisma.metaDaily.upsert({
        where: { date },
        update: {
          spend: existing?.spend ?? 0,
          purchases: existing?.purchases ?? 0,
          syncedAt: new Date(),
        },
        create: {
          date,
          spend: existing?.spend ?? 0,
          purchases: existing?.purchases ?? 0,
          syncedAt: new Date(),
        },
      });

      upserted += 1;
    }

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "success",
        message: `Backfilled ${upserted} Meta daily campaign rows (${rows.length} fetched from API) through ${yesterdayString}`,
        finishedAt: new Date(),
      },
    });

    return {
      ok: true,
      rowsFetchedFromApi: rows.length,
      totalDaysCovered: allDates.length,
      rowsUpserted: upserted,
      throughDate: yesterdayString,
    };
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "error",
        message:
          error instanceof Error ? error.message : "Unknown Meta backfill error",
        finishedAt: new Date(),
      },
    });

    throw error;
  }
}