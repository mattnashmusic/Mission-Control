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
    throw new Error(`Meta Tour API error: ${text}`);
  }

  let json: any;

  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Meta returned non-JSON response: ${text}`);
  }

  if (json.error) {
    throw new Error(`Meta Tour error: ${json.error.message}`);
  }

  return json;
}

async function fetchTourCampaignInsights(
  campaignId: string,
  datePreset: "today" | "maximum"
): Promise<{ spend: number; clicks: number }> {
  const accessToken = requireEnv(ACCESS_TOKEN, "META_ACCESS_TOKEN");

  const url =
    `https://graph.facebook.com/v25.0/${campaignId}/insights` +
    `?fields=spend,clicks&date_preset=${datePreset}&access_token=${accessToken}`;

  const json = await fetchMetaJson(url);
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
