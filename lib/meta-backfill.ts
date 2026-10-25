import { prisma } from "@/lib/prisma";
import { getFshCampaignIds } from "@/lib/meta-fsh-campaigns";

const META_API_VERSION = "v25.0";
const FSH_START_DATE = "2026-02-12";
const TIME_ZONE = "Europe/Amsterdam";

type MetaInsightsRow = {
  date_start: string;
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

  if (!accessToken) {
    throw new Error("Missing META_ACCESS_TOKEN.");
  }

  return {
    accessToken,
    campaignIds: getFshCampaignIds(),
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

function actionSafeValue(value: string | undefined) {
  if (!value) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
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

async function fetchInsightsRows(
  accessToken: string,
  campaignId: string,
  fields: string,
  untilDate: string,
  extraParams: Record<string, string> = {},
) {
  const params = new URLSearchParams({
    fields,
    time_increment: "1",
    time_range: JSON.stringify({
      since: FSH_START_DATE,
      until: untilDate,
    }),
    limit: "500",
    access_token: accessToken,
    ...extraParams,
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
    allRows.push(...(json.data ?? []));

    url = json.paging?.next ?? "";
  }

  return allRows;
}

// Spend and purchases are fetched separately. Spend is always reported by
// delivery date; combining it with action_report_time=impression in the same
// request returned rows with no spend field, which wrote 0 over every
// historical day while purchases still came through.
async function fetchDailyTotals(untilDate: string) {
  const { accessToken, campaignIds } = getMetaEnv();
  const totals = new Map<string, { spend: number; purchases: number }>();
  const perCampaign: Record<string, { spend: number; purchases: number }> = {};

  for (const campaignId of campaignIds) {
    const [spendRows, actionRows] = await Promise.all([
      fetchInsightsRows(accessToken, campaignId, "spend", untilDate),
      fetchInsightsRows(accessToken, campaignId, "actions", untilDate, {
        action_report_time: "impression",
      }),
    ]);

    let campaignSpend = 0;
    let campaignPurchases = 0;

    for (const row of spendRows) {
      const spend = Number(row.spend ?? 0);
      const entry = totals.get(row.date_start) ?? { spend: 0, purchases: 0 };
      entry.spend += spend;
      totals.set(row.date_start, entry);
      campaignSpend += spend;
    }

    for (const row of actionRows) {
      const purchases = getPurchaseCountFromActions(row.actions);
      const entry = totals.get(row.date_start) ?? { spend: 0, purchases: 0 };
      entry.purchases += purchases;
      totals.set(row.date_start, entry);
      campaignPurchases += purchases;
    }

    // Guard: a campaign with conversions but zero total spend means the API
    // response is wrong. Abort rather than overwrite good data with zeros.
    if (campaignPurchases > 0 && campaignSpend === 0) {
      throw new Error(
        `Meta returned ${campaignPurchases} purchases but no spend for campaign ${campaignId}; refusing to overwrite saved spend.`,
      );
    }

    perCampaign[campaignId] = {
      spend: Math.round(campaignSpend * 100) / 100,
      purchases: campaignPurchases,
    };
  }

  return { totals, perCampaign };
}

export async function backfillMetaDailyToDb(options: { dryRun?: boolean } = {}) {
  const yesterdayString = getYesterdayLocalDateString();

  const syncLog = await prisma.syncLog.create({
    data: {
      domain: "meta-daily-backfill",
      status: "running",
      message: `Backfilling Meta daily data from ${FSH_START_DATE} to ${yesterdayString}`,
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

    const { totals: rowMap, perCampaign } = await fetchDailyTotals(yesterdayString);

    if (options.dryRun) {
      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: {
          status: "success",
          message: `Dry run: ${JSON.stringify(perCampaign)}`,
          finishedAt: new Date(),
        },
      });

      const recent = buildDateRange(FSH_START_DATE, yesterdayString)
        .slice(-14)
        .map((d) => ({ date: d, ...(rowMap.get(d) ?? { spend: 0, purchases: 0 }) }));

      return { ok: true, dryRun: true, throughDate: yesterdayString, perCampaign, recent };
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
        message: `Backfilled ${upserted} Meta daily rows (${rowMap.size} days with data across ${Object.keys(perCampaign).length} campaigns) through ${yesterdayString}`,
        finishedAt: new Date(),
      },
    });

    return {
      ok: true,
      perCampaign,
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