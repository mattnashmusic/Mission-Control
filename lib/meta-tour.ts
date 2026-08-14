export type TourMetaSnapshot = {
  spend: {
    today: number;
    lifetime: number;
  };
  clicks: {
    today: number;
    lifetime: number;
  };
};

export type TourMetaAdSetBudget = {
  id: string;
  name: string;
  configuredStatus: string | null;
  effectiveStatus: string | null;
  included: boolean;
  dailyBudget: number | null;
};

export type TourMetaBudgetResult = {
  dailyBudget: number | null;
  attributable: boolean;
  reason: string;
  adSets: TourMetaAdSetBudget[];
};

export type TourBudgetSource = "meta" | "manual" | "unavailable";

export type ResolvedTourBudget = TourMetaBudgetResult & {
  source: TourBudgetSource;
};

type MetaAdSetResponse = {
  id: string;
  name?: string;
  campaign_id?: string;
  status?: string;
  configured_status?: string;
  effective_status?: string;
  daily_budget?: string;
  account_id?: string;
};

type MetaCampaignResponse = {
  id: string;
  status?: string;
  effective_status?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  is_adset_budget_sharing_enabled?: boolean;
};

type MetaAccountResponse = {
  id: string;
  currency?: string;
};

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing ${name} in .env.local`);
  }
  return value;
}

async function fetchMetaJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Meta Tour API error: ${text}`);
  }

  let json: unknown;

  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Meta returned non-JSON response: ${text}`);
  }

  if (
    typeof json === "object" &&
    json !== null &&
    "error" in json &&
    typeof json.error === "object" &&
    json.error !== null
  ) {
    const message =
      "message" in json.error && typeof json.error.message === "string"
        ? json.error.message
        : "Unknown Meta error";
    throw new Error(`Meta Tour error: ${message}`);
  }

  return json as T;
}

function parseMetaAmount(value: string | undefined) {
  if (value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function convertMetaDailyBudget(
  value: string | undefined,
  currency: string | undefined
): number | null {
  const amount = parseMetaAmount(value);
  if (amount === null || currency !== "EUR") return null;

  // Verified against the live EUR ad account: Meta returned "500" for €5.00.
  return amount / 100;
}

function isActive(value: string | undefined) {
  return value === "ACTIVE";
}

export function deriveTourMetaBudget({
  adSets,
  campaignsById,
  accountCurrencyById,
}: {
  adSets: MetaAdSetResponse[];
  campaignsById: Record<string, MetaCampaignResponse | undefined>;
  accountCurrencyById: Record<string, string | undefined>;
}): TourMetaBudgetResult {
  const deduplicated = Array.from(
    new Map(adSets.map((adSet) => [adSet.id, adSet])).values()
  );
  const described = deduplicated.map((adSet): TourMetaAdSetBudget => {
    const campaign = adSet.campaign_id
      ? campaignsById[adSet.campaign_id]
      : undefined;
    const included =
      isActive(adSet.status) &&
      isActive(adSet.configured_status) &&
      isActive(adSet.effective_status) &&
      isActive(campaign?.status) &&
      isActive(campaign?.effective_status);
    const dailyBudget = convertMetaDailyBudget(
      adSet.daily_budget,
      adSet.account_id ? accountCurrencyById[adSet.account_id] : undefined
    );

    return {
      id: adSet.id,
      name: adSet.name ?? adSet.id,
      configuredStatus: adSet.configured_status ?? adSet.status ?? null,
      effectiveStatus: adSet.effective_status ?? null,
      included,
      dailyBudget,
    };
  });
  const activeAdSets = described.filter((adSet) => adSet.included);

  if (activeAdSets.length === 0) {
    return {
      dailyBudget: 0,
      attributable: true,
      reason: "No matched ad sets are currently active and eligible to deliver.",
      adSets: described,
    };
  }

  if (activeAdSets.some((adSet) => adSet.dailyBudget === null)) {
    const hasSharedCampaignBudget = deduplicated.some((adSet) => {
      const campaign = adSet.campaign_id
        ? campaignsById[adSet.campaign_id]
        : undefined;
      return Boolean(
        campaign?.is_adset_budget_sharing_enabled ||
          (parseMetaAmount(campaign?.daily_budget) ?? 0) > 0 ||
          (parseMetaAmount(campaign?.lifetime_budget) ?? 0) > 0
      );
    });

    return {
      dailyBudget: null,
      attributable: false,
      reason: hasSharedCampaignBudget
        ? "Meta uses a shared campaign budget that cannot be reliably attributed to this show."
        : "Meta did not return an attributable daily budget for every active matched ad set.",
      adSets: described,
    };
  }

  return {
    dailyBudget: activeAdSets.reduce(
      (total, adSet) => total + (adSet.dailyBudget ?? 0),
      0
    ),
    attributable: true,
    reason: `${activeAdSets.length} active matched ad set${activeAdSets.length === 1 ? "" : "s"}.`,
    adSets: described,
  };
}

export function resolveTourDailyBudget(
  metaBudget: TourMetaBudgetResult | null,
  manualDailyBudget: number | null
): ResolvedTourBudget {
  if (metaBudget?.attributable && metaBudget.dailyBudget !== null) {
    return { ...metaBudget, source: "meta" };
  }

  if (manualDailyBudget !== null) {
    return {
      dailyBudget: manualDailyBudget,
      attributable: true,
      source: "manual",
      reason: metaBudget?.reason ?? "Meta budget was unavailable.",
      adSets: metaBudget?.adSets ?? [],
    };
  }

  return {
    dailyBudget: null,
    attributable: false,
    source: "unavailable",
    reason: metaBudget?.reason ?? "Meta and manual budgets are unavailable.",
    adSets: metaBudget?.adSets ?? [],
  };
}

export async function getTourMetaBudgetsByAdSetId(
  adSetIds: string[]
): Promise<Record<string, TourMetaBudgetResult>> {
  const accessToken = requireEnv(ACCESS_TOKEN, "META_ACCESS_TOKEN");
  const uniqueIds = Array.from(new Set(adSetIds));
  if (uniqueIds.length === 0) return {};

  const adSetFields = [
    "id",
    "name",
    "campaign_id",
    "status",
    "configured_status",
    "effective_status",
    "daily_budget",
    "account_id",
  ].join(",");
  const adSetUrl = new URL(`https://graph.facebook.com/v25.0/`);
  adSetUrl.searchParams.set("ids", uniqueIds.join(","));
  adSetUrl.searchParams.set("fields", adSetFields);
  adSetUrl.searchParams.set("access_token", accessToken);
  const adSetsById = await fetchMetaJson<Record<string, MetaAdSetResponse>>(
    adSetUrl.toString()
  );
  const adSets = Object.values(adSetsById);
  const campaignIds = Array.from(
    new Set(adSets.map((adSet) => adSet.campaign_id).filter(Boolean))
  ) as string[];
  const accountIds = Array.from(
    new Set(adSets.map((adSet) => adSet.account_id).filter(Boolean))
  ) as string[];

  const fetchNodes = async <T>(ids: string[], fields: string) => {
    if (ids.length === 0) return {} as Record<string, T>;
    const url = new URL(`https://graph.facebook.com/v25.0/`);
    url.searchParams.set("ids", ids.join(","));
    url.searchParams.set("fields", fields);
    url.searchParams.set("access_token", accessToken);
    return fetchMetaJson<Record<string, T>>(url.toString());
  };
  const [campaignsById, accountsByNodeId] = await Promise.all([
    fetchNodes<MetaCampaignResponse>(
      campaignIds,
      "id,status,effective_status,daily_budget,lifetime_budget,is_adset_budget_sharing_enabled"
    ),
    fetchNodes<MetaAccountResponse>(
      accountIds.map((id) => `act_${id}`),
      "id,currency"
    ),
  ]);
  const accountCurrencyById = Object.values(accountsByNodeId).reduce<
    Record<string, string | undefined>
  >((result, account) => {
    result[account.id.replace(/^act_/, "")] = account.currency;
    return result;
  }, {});

  return uniqueIds.reduce<Record<string, TourMetaBudgetResult>>((result, id) => {
    const adSet = adSetsById[id];
    if (adSet) {
      result[id] = deriveTourMetaBudget({
        adSets: [adSet],
        campaignsById,
        accountCurrencyById,
      });
    }
    return result;
  }, {});
}

async function fetchTourCampaignInsights(
  campaignId: string,
  datePreset: "today" | "maximum"
): Promise<{ spend: number; clicks: number }> {
  const accessToken = requireEnv(ACCESS_TOKEN, "META_ACCESS_TOKEN");

  const url =
    `https://graph.facebook.com/v25.0/${campaignId}/insights` +
    `?fields=spend,clicks&date_preset=${datePreset}&access_token=${accessToken}`;

  const json = await fetchMetaJson<{
    data?: Array<{ spend?: string; clicks?: string }>;
  }>(url);
  const row = json.data?.[0];

  return {
    spend: row?.spend ? Number(row.spend) : 0,
    clicks: row?.clicks ? Number(row.clicks) : 0,
  };
}

export async function getTourMetaSnapshot(
  campaignId: string
): Promise<TourMetaSnapshot> {
  const [today, lifetime] = await Promise.all([
    fetchTourCampaignInsights(campaignId, "today"),
    fetchTourCampaignInsights(campaignId, "maximum"),
  ]);

  return {
    spend: {
      today: today.spend,
      lifetime: lifetime.spend,
    },
    clicks: {
      today: today.clicks,
      lifetime: lifetime.clicks,
    },
  };
}
