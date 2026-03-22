import { prisma } from "@/lib/prisma";

const META_API_VERSION = "v25.0";
const FSH_START_DATE = "2026-02-12";

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

  const adAccountId =
    process.env.META_AD_ACCOUNT_ID ||
    process.env.FACEBOOK_AD_ACCOUNT_ID ||
    process.env.META_ACCOUNT_ID;

  if (!accessToken || !adAccountId) {
    throw new Error(
      "Missing META_ACCESS_TOKEN (or FACEBOOK_ACCESS_TOKEN) or META_AD_ACCOUNT_ID (or FACEBOOK_AD_ACCOUNT_ID)."
    );
  }

  return {
    accessToken,
    adAccountId: adAccountId.startsWith("act_")
      ? adAccountId
      : `act_${adAccountId}`,
  };
}

function startOfUtcDayFromDateString(dateString: string) {
  return new Date(`${dateString}T00:00:00.000Z`);
}

function formatUtcDate(date: Date) {
  return date.toISOString().slice(0, 10);
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

  return purchaseAction ? Number(purchaseAction.value || 0) : 0;
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

async function fetchAllMetaInsightsRows() {
  const { accessToken, adAccountId } = getMetaEnv();
  const todayString = new Date().toISOString().slice(0, 10);

  const params = new URLSearchParams({
    fields: "spend,actions",
    level: "account",
    time_increment: "1",
    action_report_time: "conversion",
    time_range: JSON.stringify({
      since: FSH_START_DATE,
      until: todayString,
    }),
    limit: "500",
    access_token: accessToken,
  });

  let url = `https://graph.facebook.com/${META_API_VERSION}/${adAccountId}/insights?${params.toString()}`;
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
  const syncLog = await prisma.syncLog.create({
    data: {
      domain: "meta-daily-backfill",
      status: "running",
      message: `Backfilling Meta daily data from ${FSH_START_DATE}`,
    },
  });

  try {
    const todayString = new Date().toISOString().slice(0, 10);
    const rows = await fetchAllMetaInsightsRows();

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

    const allDates = buildDateRange(FSH_START_DATE, todayString);
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
        message: `Backfilled ${upserted} Meta daily rows (${rows.length} fetched from API)`,
        finishedAt: new Date(),
      },
    });

    return {
      ok: true,
      rowsFetchedFromApi: rows.length,
      totalDaysCovered: allDates.length,
      rowsUpserted: upserted,
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