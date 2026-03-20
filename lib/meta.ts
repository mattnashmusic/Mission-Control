export type MetaSnapshot = {
  spend: {
    today: number;
    yesterday: number;
    sevenDay: number;
    thirtyDay: number;
    lifetime: number;
  };
  dailyBudget: number;
};

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const CAMPAIGN_ID = process.env.META_CAMPAIGN_ID;

function requireEnv(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Missing ${name} in .env.local`);
  }
  return value;
}

async function fetchCampaignSpend(datePreset: string): Promise<number> {
  const accessToken = requireEnv(ACCESS_TOKEN, "META_ACCESS_TOKEN");
  const campaignId = requireEnv(CAMPAIGN_ID, "META_CAMPAIGN_ID");

  const url =
    `https://graph.facebook.com/v25.0/${campaignId}/insights` +
    `?fields=spend&date_preset=${datePreset}&access_token=${accessToken}`;

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

  const spend = json.data?.[0]?.spend;
  return spend ? Number(spend) : 0;
}

async function fetchCampaignDailyBudget(): Promise<number> {
  const accessToken = requireEnv(ACCESS_TOKEN, "META_ACCESS_TOKEN");
  const campaignId = requireEnv(CAMPAIGN_ID, "META_CAMPAIGN_ID");

  const url =
    `https://graph.facebook.com/v25.0/${campaignId}` +
    `?fields=daily_budget&access_token=${accessToken}`;

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

  return json.daily_budget ? Number(json.daily_budget) / 100 : 0;
}

export async function getMetaSnapshot(): Promise<MetaSnapshot> {
  const [today, yesterday, sevenDay, thirtyDay, lifetime, dailyBudget] =
    await Promise.all([
      fetchCampaignSpend("today"),
      fetchCampaignSpend("yesterday"),
      fetchCampaignSpend("last_7d"),
      fetchCampaignSpend("last_30d"),
      fetchCampaignSpend("maximum"),
      fetchCampaignDailyBudget(),
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
  };
}