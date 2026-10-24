// FSH is marketed with more than one Meta campaign (main prospecting +
// vinyl retargeting). Spend on the FSH page must sum all of them.
//
// Set META_CAMPAIGN_IDS to a comma-separated list to override. Falls back to
// META_CAMPAIGN_ID plus the known vinyl retargeting campaign.
const FSH_VINYL_RETARGETING_CAMPAIGN_ID = "120248175974360724"; // "F +S/H Warm Vinyl"

export function getFshCampaignIds(): string[] {
  const fromList = (process.env.META_CAMPAIGN_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  if (fromList.length > 0) return Array.from(new Set(fromList));

  const primary = process.env.META_CAMPAIGN_ID?.trim();
  if (!primary) {
    throw new Error("Missing META_CAMPAIGN_IDS or META_CAMPAIGN_ID.");
  }

  return Array.from(new Set([primary, FSH_VINYL_RETARGETING_CAMPAIGN_ID]));
}
