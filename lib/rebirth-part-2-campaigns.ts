export type RegistrationCampaignConfig = {
  city: string;
  country: string;
  countryCode: string;
  venue: string;
  showDate: string; // YYYY-MM-DD
  source: string;
  metaCampaignId: string;
  manualAdSpendTotal?: number;
  manualAdSpendToday?: number;
};

// Rebirth Tour Part 2 (May 2027). Each city's Shopify registration page posts
// `source` to /api/registration. Add the Meta campaign ID once the ads exist.
export const REBIRTH_PART_2_CAMPAIGNS: RegistrationCampaignConfig[] = [
  { city: "Antwerp", country: "Belgium", countryCode: "BE", venue: "Kavka", showDate: "2027-05-06", source: "antwerp_lp", metaCampaignId: "" },
  { city: "Paris", country: "France", countryCode: "FR", venue: "Casino Noveau", showDate: "2027-05-07", source: "paris_lp", metaCampaignId: "" },
  { city: "Frankfurt", country: "Germany", countryCode: "DE", venue: "Ponyhof", showDate: "2027-05-09", source: "frankfurt_lp", metaCampaignId: "" },
  { city: "Nuremberg", country: "Germany", countryCode: "DE", venue: "Z-bau", showDate: "2027-05-11", source: "nuremberg_lp", metaCampaignId: "" },
  { city: "Vienna", country: "Austria", countryCode: "AT", venue: "Flucc", showDate: "2027-05-12", source: "vienna_lp", metaCampaignId: "" },
  { city: "Prague", country: "Czechia", countryCode: "CZ", venue: "Cafe Vlese", showDate: "2027-05-13", source: "prague_lp", metaCampaignId: "" },
  { city: "Leipzig", country: "Germany", countryCode: "DE", venue: "Naumanns Tanzlokal", showDate: "2027-05-15", source: "leipzig_lp", metaCampaignId: "" },
  { city: "Utrecht", country: "Netherlands", countryCode: "NL", venue: "Dbs", showDate: "2027-05-19", source: "utrecht_lp", metaCampaignId: "" },
  { city: "Den Haag", country: "Netherlands", countryCode: "NL", venue: "Pip", showDate: "2027-05-22", source: "denhaag_lp", metaCampaignId: "" },
  { city: "Dortmund", country: "Germany", countryCode: "DE", venue: "FZW", showDate: "2027-05-25", source: "dortmund_lp", metaCampaignId: "" },
  { city: "Arnhem", country: "Netherlands", countryCode: "NL", venue: "Luxor", showDate: "2027-05-26", source: "arnhem_lp", metaCampaignId: "" },
  { city: "Eindhoven", country: "Netherlands", countryCode: "NL", venue: "Effenaar", showDate: "2027-05-28", source: "eindhoven_lp", metaCampaignId: "" },
  { city: "Groningen", country: "Netherlands", countryCode: "NL", venue: "Huize Maas", showDate: "2027-05-29", source: "groningen_lp", metaCampaignId: "" },
];

const KNOWN_SOURCES = new Set(
  REBIRTH_PART_2_CAMPAIGNS.map((campaign) => campaign.source)
);

export function isKnownRegistrationSource(source: string) {
  return KNOWN_SOURCES.has(source);
}
