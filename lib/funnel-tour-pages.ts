// Maps a Show's internal slug (used for Eventbrite/Meta matching, e.g.
// "hamburg-2026") to the actual Shopify bridge page handle that fans land
// on between the Meta ad and the external ticket link (e.g.
// "hamburg-rebirth" -> mattnash.com/pages/hamburg-rebirth). Funnel tracking
// events are recorded against this page handle, not the Show slug.
export const TOUR_SHOW_PAGE_SLUGS: Record<string, string> = {
  "hamburg-2026": "hamburg-rebirth",
  "berlin-2026": "berlin-rebirth",
  "munich-2026": "munich-rebirth",
  "zurich-2026": "zurich-rebirth",
  "cologne-2026": "cologne-rebirth",
  "brussels-2026": "brussels-rebirth",
  "nijmegen-2026": "nijmegen-rebirth",
  "amsterdam-2026": "amsterdam-rebirth",
};
