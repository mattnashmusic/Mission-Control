export type TourCampaignConfig = {
  city: string;
  country: string;
  source: string;
  matchSources: string[];
  metaCampaignId: string;
};

export const TOUR_CAMPAIGNS: TourCampaignConfig[] = [
  {
    city: "Tour Vote",
    country: "Multi-country",
    source: "tourvote",
    matchSources: ["tourvote", "tour_vote", "Tour Vote"],
    metaCampaignId: "120243220166110724",
  },
  {
    city: "Hamburg",
    country: "Germany",
    source: "hamburg_signup",
    matchSources: ["hamburg_signup", "hamburg", "Matt Nash Live in Hamburg"],
    metaCampaignId: "120244349071170724",
  },
  {
    city: "Amsterdam",
    country: "Netherlands",
    source: "amsterdam_signup",
    matchSources: ["amsterdam_signup", "amsterdam", "Matt Nash Live in Amsterdam"],
    metaCampaignId: "",
  },
  {
    city: "Cologne",
    country: "Germany",
    source: "cologne_signup",
    matchSources: ["cologne_signup", "cologne", "Matt Nash Live in Cologne"],
    metaCampaignId: "",
  },
  {
    city: "Berlin",
    country: "Germany",
    source: "berlin_signup",
    matchSources: ["berlin_signup", "berlin", "Matt Nash Live In Berlin"],
    metaCampaignId: "",
  },
  {
    city: "Brussels",
    country: "Belgium",
    source: "brussels_signup",
    matchSources: ["brussels_signup", "brussels"],
    metaCampaignId: "",
  },
];