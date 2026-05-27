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
    city: "Amsterdam LP",
    country: "Netherlands",
    source: "amsterdam_lp",
    matchSources: ["amsterdam_lp"],
    metaCampaignId: "120244570933250724",
  },

  {
    city: "Cologne LP",
    country: "Germany",
    source: "cologne_lp",
    matchSources: ["cologne_lp"],
    metaCampaignId: "120244639022270724",
  },

  {
    city: "Berlin LP",
    country: "Germany",
    source: "berlin_lp",
    matchSources: ["berlin_lp"],
    metaCampaignId: "120244638610400724",
  },

  {
    city: "Brussels LP",
    country: "Belgium",
    source: "brussels_lp",
    matchSources: ["brussels_lp"],
    metaCampaignId: "120244728123040724",
  },

  {
    city: "Zurich LP",
    country: "Switzerland",
    source: "zurich_lp",
    matchSources: ["zurich_lp"],
    metaCampaignId: "",
  },

  {
    city: "Munich LP",
    country: "Germany",
    source: "munich_lp",
    matchSources: ["munich_lp"],
    metaCampaignId: "",
  },
];