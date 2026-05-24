export type TourCampaignConfig = {
  city: string;
  country: string;
  source: string;
  matchSources: string[];
  metaCampaignId: string;
  manualAdSpendTotal?: number;
  manualAdSpendToday?: number;
};

export const TOUR_CAMPAIGNS: TourCampaignConfig[] = [
  {
    city: "Hamburg LP",
    country: "Germany",
    source: "hamburg_lp",
    matchSources: ["hamburg_lp"],
    metaCampaignId: "120244349071170724",
  },
  {
    city: "Tour Vote",
    country: "Multi-country",
    source: "tourvote",
    matchSources: ["tourvote", "tour_vote"],
    metaCampaignId: "",
    manualAdSpendTotal: 370.16,
  },
  {
    city: "Amsterdam",
    country: "Netherlands",
    source: "amsterdam_signup",
    matchSources: ["amsterdam_signup"],
    metaCampaignId: "",
  },
  {
    city: "Cologne",
    country: "Germany",
    source: "cologne_signup",
    matchSources: ["cologne_signup"],
    metaCampaignId: "",
  },
  {
    city: "Berlin",
    country: "Germany",
    source: "berlin_signup",
    matchSources: ["berlin_signup"],
    metaCampaignId: "",
  },
  {
    city: "Brussels",
    country: "Belgium",
    source: "brussels_signup",
    matchSources: ["brussels_signup"],
    metaCampaignId: "",
  },
];