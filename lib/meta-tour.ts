const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN!;
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID!;

type MetaTourSnapshot = {
  spend: number;
  clicks: number;
};

export async function getTourMetaSnapshot(campaignId: string): Promise<MetaTourSnapshot> {
  const url = `https://graph.facebook.com/v19.0/act_${AD_ACCOUNT_ID}/insights?fields=spend,clicks&date_preset=today&filtering=[{"field":"campaign.id","operator":"IN","value":["${campaignId}"]}]&access_token=${ACCESS_TOKEN}`;

  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();

  if (json.error) {
    console.error("❌ Meta Tour API error:", json.error);
    return { spend: 0, clicks: 0 };
  }

  const data = json.data?.[0];

  return {
    spend: parseFloat(data?.spend || "0"),
    clicks: Number(data?.clicks || 0),
  };
}