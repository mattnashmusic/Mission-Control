// Shared Mapbox geocoding helpers used across the email tab's API routes.
// Centralised here so the audience clustering route, the upcoming-shows
// route, and the free-text city search route all share one cache and one
// normalisation logic instead of drifting out of sync.

export type LatLng = { lat: number; lng: number };

export type GeocodeMatch = LatLng & {
  placeName: string;
  city: string;
  country: string;
};

const geocodeCache = new Map<string, LatLng | null>();
const searchCache = new Map<string, GeocodeMatch[]>();

export const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  australia: "AU",
  austria: "AT",
  belgium: "BE",
  canada: "CA",
  france: "FR",
  germany: "DE",
  ireland: "IE",
  italy: "IT",
  netherlands: "NL",
  spain: "ES",
  switzerland: "CH",
  "united kingdom": "GB",
  uk: "GB",
  "great britain": "GB",
  england: "GB",
  "united states": "US",
  usa: "US",
};

export function toCountryCode(country: string) {
  return COUNTRY_NAME_TO_CODE[country.toLowerCase()] || "";
}

/**
 * Geocode a known (city, country) pair, e.g. for turning a Show or a
 * contact's location fields into map coordinates. Cached in-memory per
 * server process, same as the original implementation in the audience
 * route.
 */
export async function geocodeCity(
  city: string,
  country: string,
  token: string
): Promise<LatLng | null> {
  const cacheKey = `${city}__${country}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) ?? null;
  }

  const countryCode = toCountryCode(country);
  const q = `${city}, ${country}`;

  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", q);
  url.searchParams.set("types", "place");
  url.searchParams.set("limit", "1");
  url.searchParams.set("access_token", token);

  if (countryCode) {
    url.searchParams.set("country", countryCode);
  }

  const response = await fetch(url.toString(), {
    headers: { "Content-Type": "application/json" },
    cache: "force-cache",
  });

  if (!response.ok) {
    geocodeCache.set(cacheKey, null);
    return null;
  }

  const json = await response.json();
  const feature = json.features?.[0];
  const coordinates = feature?.geometry?.coordinates;

  if (
    !Array.isArray(coordinates) ||
    typeof coordinates[0] !== "number" ||
    typeof coordinates[1] !== "number"
  ) {
    geocodeCache.set(cacheKey, null);
    return null;
  }

  const result: LatLng = { lng: coordinates[0], lat: coordinates[1] };
  geocodeCache.set(cacheKey, result);
  return result;
}

/**
 * Free-text place search for the "search any city" box on the email tab.
 * Unlike geocodeCity this doesn't assume a known country, and returns
 * several candidate matches so the UI can offer a picker when the query
 * is ambiguous (e.g. "Springfield").
 */
export async function searchPlaces(
  query: string,
  token: string,
  limit = 5
): Promise<GeocodeMatch[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cacheKey = `${trimmed.toLowerCase()}__${limit}`;
  if (searchCache.has(cacheKey)) {
    return searchCache.get(cacheKey) ?? [];
  }

  const url = new URL("https://api.mapbox.com/search/geocode/v6/forward");
  url.searchParams.set("q", trimmed);
  url.searchParams.set("types", "place");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("access_token", token);

  const response = await fetch(url.toString(), {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    return [];
  }

  const json = await response.json();
  const features: any[] = Array.isArray(json.features) ? json.features : [];

  const matches: GeocodeMatch[] = features
    .map((feature) => {
      const coordinates = feature?.geometry?.coordinates;
      if (
        !Array.isArray(coordinates) ||
        typeof coordinates[0] !== "number" ||
        typeof coordinates[1] !== "number"
      ) {
        return null;
      }

      const context = feature?.properties?.context ?? {};
      const city =
        feature?.properties?.name ?? feature?.properties?.place_formatted ?? trimmed;
      const country = context?.country?.name ?? "";

      return {
        lng: coordinates[0],
        lat: coordinates[1],
        placeName: feature?.properties?.full_address ?? feature?.properties?.place_formatted ?? city,
        city,
        country,
      } satisfies GeocodeMatch;
    })
    .filter((match): match is GeocodeMatch => match !== null);

  searchCache.set(cacheKey, matches);
  return matches;
}
