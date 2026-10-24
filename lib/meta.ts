export type MetaSnapshot = {
  spend: {
    today: number;
    yesterday: number;
    sevenDay: number;
    thirtyDay: number;
    lifetime: number;
  };
  dailyBudget: number;
  salesTrackedToday: number;
};

import { getFshCampaignIds } from "@/lib/meta-fsh-campaigns";

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing ${name} in .env.local`);
  }
  return value;
}

async function fetchMetaJson(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Meta API error: ${text}`);
  }

  let json: any;

  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Meta returned non-JSON response: ${text}`);
  }

  if (json.error) {
    throw new Error(`Meta error: ${json.error.message}`);
  }

  return json;
}

async function fetchCampaignSpend(
  campaignId: string,
  datePreset: string,
): Promise<number> {
  const accessToken = requireEnv(ACCESS_TOKEN, "META_ACCESS_TOKEN");

  const url =
    `https://graph.facebook.com/v25.0/${campaignId}/insights` +
    `?fields=spend&date_preset=${datePreset}&access_token=${accessToken}`;

  const json = await fetchMetaJson(url);

  const spend = json.data?.[0]?.spend;
  return spend ? Number(spend) : 0;
}

async function fetchCampaignDailyBudget(campaignId: string): Promise<number> {
  const accessToken = requireEnv(ACCESS_TOKEN, "META_ACCESS_TOKEN");

  const url =
    `https://graph.facebook.com/v25.0/${campaignId}` +
    `?fields=daily_budget,effective_status,adsets{daily_budget,effective_status}` +
    `&access_token=${accessToken}`;

  const json = await fetchMetaJson(url);

  if (json.effective_status && json.effective_status !== "ACTIVE") return 0;

  // Campaign budget (CBO) if set, otherwise sum active ad set budgets (ABO).
  if (json.daily_budget) return Number(json.daily_budget) / 100;

  const adsets: Array<{ daily_budget?: string; effective_status?: string }> =
    json.adsets?.data ?? [];

  return adsets
    .filter((a) => a.effective_status === "ACTIVE" && a.daily_budget)
    .reduce((sum, a) => sum + Number(a.daily_budget) / 100, 0);
}

async function fetchCampaignPurchases(
  campaignId: string,
  datePreset: string,
): Promise<number> {
  const accessToken = requireEnv(ACCESS_TOKEN, "META_ACCESS_TOKEN");

  const url =
    `https://graph.facebook.com/v25.0/${campaignId}/insights` +
    `?fields=actions&date_preset=${datePreset}&access_token=${accessToken}`;

  const json = await fetchMetaJson(url);

  const actions = json.data?.[0]?.actions;

  if (!Array.isArray(actions)) {
    return 0;
  }

  const websitePurchaseAction = actions.find(
    (action: { action_type?: string; value?: string }) =>
      action.action_type === "purchase" ||
      action.action_type === "offsite_conversion.fb_pixel_purchase" ||
      action.action_type === "omni_purchase"
  );

  return websitePurchaseAction?.value
    ? Number(websitePurchaseAction.value)
    : 0;
}

async function sumAcrossCampaigns(
  fn: (campaignId: string) => Promise<number>,
): Promise<number> {
  const values = await Promise.all(getFshCampaignIds().map(fn));
  return values.reduce((sum, v) => sum + v, 0);
}

export async function getMetaSpendForDatePreset(datePreset: string) {
  return sumAcrossCampaigns((id) => fetchCampaignSpend(id, datePreset));
}

export async function getMetaPurchasesForDatePreset(datePreset: string) {
  return sumAcrossCampaigns((id) => fetchCampaignPurchases(id, datePreset));
}

export async function getMetaSnapshot(): Promise<MetaSnapshot> {
  const [
    today,
    yesterday,
    sevenDay,
    thirtyDay,
    lifetime,
    dailyBudget,
    salesTrackedToday,
  ] = await Promise.all([
    getMetaSpendForDatePreset("today"),
    getMetaSpendForDatePreset("yesterday"),
    getMetaSpendForDatePreset("last_7d"),
    getMetaSpendForDatePreset("last_30d"),
    getMetaSpendForDatePreset("maximum"),
    sumAcrossCampaigns(fetchCampaignDailyBudget),
    getMetaPurchasesForDatePreset("today"),
  ]);

  return {
    spend: {
      today,
      yesterday,
      sevenDay,
      thirtyDay,
      lifetime,
    },
    dailyBudget,
    salesTrackedToday,
  };
}
