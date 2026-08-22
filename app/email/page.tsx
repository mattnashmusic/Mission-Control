"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FanMap from "@/components/email/FanMap";
import { getAudienceInRadius, type CityCluster } from "@/lib/email/audience";
import {
  getSavedAudiences,
  saveAudience,
  deleteAudience,
  type SavedAudience,
} from "@/lib/email/savedAudiences";

// Sane fallback until either an upcoming show or a saved audience sets a
// real location. Berlin, matching the tab's old default.
const DEFAULT_CENTER = { lat: 52.52, lng: 13.405 };
const DEFAULT_LABEL = "Berlin, Germany";

type AudienceApiResponse = {
  clusters?: (CityCluster & {
    emails?: string[];
    mailerLiteEmails?: string[];
    shopifyOnlyEmails?: string[];
  })[];
  stats?: {
    totalRows?: number;
    totalSourceRows?: number;
    mailerLiteRows?: number;
    shopifyRows?: number;
    uniqueContacts?: number;
    usableRows?: number;
    skippedRows?: number;
    overlapContacts?: number;
    mailerLiteOnlyContacts?: number;
    shopifyOnlyContacts?: number;
    groupableContacts?: number;
    uniqueCities?: number;
  };
};

type UpcomingShow = {
  id: string;
  slug: string;
  date: string;
  city: string;
  country: string;
  venue: string;
  lat: number;
  lng: number;
};

type GeocodeMatch = {
  lat: number;
  lng: number;
  placeName: string;
  city: string;
  country: string;
};

type Location = {
  lat: number;
  lng: number;
  label: string;
  city: string;
  country: string | null;
};

export default function EmailPage() {
  const [radiusKm, setRadiusKm] = useState(100);
  const [location, setLocation] = useState<Location>({
    ...DEFAULT_CENTER,
    label: DEFAULT_LABEL,
    city: "Berlin",
    country: "Germany",
  });
  const [selectedShowId, setSelectedShowId] = useState<string | null>(null);

  const [data, setData] = useState<AudienceApiResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [upcomingShows, setUpcomingShows] = useState<UpcomingShow[]>([]);
  const [showsLoading, setShowsLoading] = useState(true);
  const [showsError, setShowsError] = useState("");
  const hasAutoSelectedShow = useRef(false);

  const [citySearchQuery, setCitySearchQuery] = useState("");
  const [citySearchResults, setCitySearchResults] = useState<GeocodeMatch[]>([]);
  const [citySearchOpen, setCitySearchOpen] = useState(false);
  const [citySearching, setCitySearching] = useState(false);

  const [savedAudiences, setSavedAudiences] = useState<SavedAudience[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savingAudience, setSavingAudience] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSaved() {
      try {
        const audiences = await getSavedAudiences();
        if (!cancelled) setSavedAudiences(audiences);
      } finally {
        if (!cancelled) setSavedLoading(false);
      }
    }

    loadSaved();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAudience() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/email/audience", {
          cache: "no-store",
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Failed to load audience data");
        }

        const json: AudienceApiResponse = await response.json();

        if (!cancelled) {
          setData(json);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load audience data"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAudience();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadShows() {
      try {
        setShowsLoading(true);
        setShowsError("");

        const response = await fetch("/api/email/shows", { cache: "no-store" });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Failed to load upcoming shows");
        }

        const json = await response.json();
        const shows: UpcomingShow[] = json.shows ?? [];

        if (!cancelled) {
          setUpcomingShows(shows);

          if (shows.length > 0 && !hasAutoSelectedShow.current) {
            hasAutoSelectedShow.current = true;
            selectShow(shows[0]);
          }
        }
      } catch (err) {
        // Non-fatal — search and saved audiences still work without shows.
        if (!cancelled) {
          setShowsError(
            err instanceof Error ? err.message : "Failed to load upcoming shows"
          );
        }
      } finally {
        if (!cancelled) setShowsLoading(false);
      }
    }

    loadShows();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const query = citySearchQuery.trim();
    if (!query) {
      setCitySearchResults([]);
      setCitySearching(false);
      return;
    }

    let cancelled = false;
    setCitySearching(true);

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/email/geocode?q=${encodeURIComponent(query)}`,
          { cache: "no-store" }
        );

        if (!response.ok) throw new Error("Search failed");

        const json = await response.json();
        if (!cancelled) {
          setCitySearchResults(json.matches ?? []);
        }
      } catch {
        if (!cancelled) setCitySearchResults([]);
      } finally {
        if (!cancelled) setCitySearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [citySearchQuery]);

  const cityClusters = data?.clusters ?? [];
  const stats = data?.stats ?? {};
  const totalSourceRows = stats.totalRows ?? stats.totalSourceRows ?? 0;
  const summary = useMemo(() => getAudienceSummaryFromClusters(cityClusters), [cityClusters]);

  const radiusResult = useMemo(() => {
    return getAudienceInRadius(cityClusters, location.lat, location.lng, radiusKm);
  }, [cityClusters, location.lat, location.lng, radiusKm]);

  const topSelectedCities = radiusResult.clusters.slice(0, 8);

  const mailerLiteCount = useMemo(
    () =>
      radiusResult.clusters.reduce(
        (sum, cluster: any) => sum + (cluster.mailerLiteEmails?.length ?? 0),
        0
      ),
    [radiusResult.clusters]
  );
  const shopifyOnlyCount = Math.max(radiusResult.totalContacts - mailerLiteCount, 0);

  // Audience size per upcoming show, at the currently selected radius, so
  // each show chip can answer "how big is my audience there" at a glance.
  const showAudienceCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const show of upcomingShows) {
      const result = getAudienceInRadius(cityClusters, show.lat, show.lng, radiusKm);
      map.set(show.id, result.totalContacts);
    }
    return map;
  }, [upcomingShows, cityClusters, radiusKm]);

  function selectShow(show: UpcomingShow) {
    setSelectedShowId(show.id);
    setLocation({
      lat: show.lat,
      lng: show.lng,
      label: `${show.city}, ${show.country}`,
      city: show.city,
      country: show.country,
    });
    setCitySearchQuery("");
    setCitySearchResults([]);
    setCitySearchOpen(false);
  }

  function selectSearchMatch(match: GeocodeMatch) {
    setSelectedShowId(null);
    setLocation({
      lat: match.lat,
      lng: match.lng,
      label: match.country ? `${match.city}, ${match.country}` : match.city || match.placeName,
      city: match.city || match.placeName,
      country: match.country || null,
    });
    setCitySearchQuery("");
    setCitySearchResults([]);
    setCitySearchOpen(false);
  }

  async function handleCreateGroup() {
    try {
      setCreatingGroup(true);

      const emails = radiusResult.clusters.flatMap(
        (cluster: any) => cluster.mailerLiteEmails ?? []
      );

      const response = await fetch("/api/email/create-group", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `${location.label} ${radiusKm}km`,
          emails,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.message || "Failed to create MailerLite group");
      }

      alert(
        `MailerLite group created: ${result.name}\n${result.count} subscribers added`
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create MailerLite group");
    } finally {
      setCreatingGroup(false);
    }
  }

  async function handleSaveAudience() {
    try {
      setSavingAudience(true);

      const created = await saveAudience({
        name: `${location.label} ${radiusKm}km`,
        city: location.city,
        country: location.country,
        lat: location.lat,
        lng: location.lng,
        radiusKm,
        showId: selectedShowId,
      });

      setSavedAudiences((prev) => [created, ...prev]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save audience");
    } finally {
      setSavingAudience(false);
    }
  }

  function handleLoadAudience(audience: SavedAudience) {
    setSelectedShowId(audience.showId);
    setLocation({
      lat: audience.lat,
      lng: audience.lng,
      label: audience.country ? `${audience.city}, ${audience.country}` : audience.city,
      city: audience.city,
      country: audience.country,
    });
    setRadiusKm(audience.radiusKm);
  }

  async function handleDeleteAudience(id: string) {
    const previous = savedAudiences;
    setSavedAudiences((prev) => prev.filter((audience) => audience.id !== id));

    try {
      await deleteAudience(id);
    } catch (err) {
      setSavedAudiences(previous);
      alert(err instanceof Error ? err.message : "Failed to delete audience");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Email</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            Visualise your fanbase and build geo-targeted segments for upcoming shows.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-[#262626] bg-[#111] px-3 py-2 text-xs text-gray-400">
          <span className="h-2 w-2 rounded-full bg-[#f0c94c]" />
          Real subscriber data loaded
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Usable Contacts" value={summary.totalContacts.toLocaleString()} />
        <StatCard label="Cities Reached" value={summary.totalCities.toLocaleString()} />
        <StatCard
          label="Largest Cluster"
          value={
            summary.largestCluster
              ? `${summary.largestCluster.city} (${summary.largestCluster.count})`
              : "—"
          }
        />
        <StatCard
          label="Top Country"
          value={
            summary.topCountry
              ? `${summary.topCountry.country} (${summary.topCountry.count})`
              : "—"
          }
        />
      </section>

      {upcomingShows.length > 0 && (
        <section className="rounded-3xl border border-[#262626] bg-[#111] p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Upcoming Shows</h2>
              <p className="mt-1 text-sm text-gray-400">
                Pulled from your tour dates. Pick a show to center the map and radius on it.
              </p>
            </div>
            {showsLoading && <span className="text-xs text-gray-500">Loading…</span>}
          </div>

          <div className="flex flex-wrap gap-2">
            {upcomingShows.map((show) => {
              const isSelected = selectedShowId === show.id;
              const count = showAudienceCounts.get(show.id) ?? 0;

              return (
                <button
                  key={show.id}
                  onClick={() => selectShow(show)}
                  className={`flex flex-col items-start rounded-2xl border px-4 py-2.5 text-left transition ${
                    isSelected
                      ? "border-[#f0c94c] bg-[#2b2208]"
                      : "border-[#343434] bg-[#161616] hover:border-[#4a4a4a]"
                  }`}
                >
                  <span className={`text-sm font-semibold ${isSelected ? "text-[#f0c94c]" : "text-white"}`}>
                    {show.city}, {show.country}
                  </span>
                  <span className="mt-0.5 text-xs text-gray-500">
                    {formatShowDate(show.date)} · {show.venue}
                  </span>
                  <span className="mt-1 text-xs text-gray-400">
                    {count.toLocaleString()} contact{count === 1 ? "" : "s"} within {radiusKm} km
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      {showsError && (
        <p className="text-xs text-red-400">Couldn&apos;t load upcoming shows: {showsError}</p>
      )}

      <section className="overflow-hidden rounded-3xl border border-[#262626] bg-[#111]">
        <div className="border-b border-[#202020] px-5 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Audience Map</h2>
              <p className="mt-1 text-sm text-gray-400">
                Search any city and radius to see who is nearby.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <ControlField label="City">
                <div className="relative">
                  <input
                    type="text"
                    value={citySearchQuery}
                    onChange={(e) => {
                      setCitySearchQuery(e.target.value);
                      setCitySearchOpen(true);
                    }}
                    onFocus={() => setCitySearchOpen(true)}
                    onBlur={() => {
                      setTimeout(() => setCitySearchOpen(false), 150);
                    }}
                    placeholder={location.label}
                    className="w-[220px] rounded-xl border border-[#343434] bg-[#161616] px-3 py-2 text-sm text-white outline-none transition placeholder:text-gray-500 hover:border-[#4a4a4a] focus:border-[#f0c94c]"
                  />

                  {citySearchOpen && (citySearching || citySearchResults.length > 0) && (
                    <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-[#343434] bg-[#161616] shadow-xl">
                      {citySearching ? (
                        <div className="px-3 py-2 text-xs text-gray-500">Searching…</div>
                      ) : (
                        citySearchResults.map((match, index) => (
                          <button
                            key={`${match.placeName}-${index}`}
                            onMouseDown={() => selectSearchMatch(match)}
                            className="block w-full px-3 py-2 text-left text-sm text-gray-200 transition hover:bg-[#232323]"
                          >
                            {match.placeName}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </ControlField>

              <ControlField label="Radius">
                <select
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(Number(e.target.value))}
                  className="min-w-[110px] rounded-xl border border-[#343434] bg-[#161616] px-3 py-2 text-sm text-white outline-none transition hover:border-[#4a4a4a]"
                >
                  {[25, 50, 100, 150, 200].map((radius) => (
                    <option key={radius} value={radius}>
                      {radius} km
                    </option>
                  ))}
                </select>
              </ControlField>
            </div>
          </div>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex h-[620px] items-center justify-center rounded-2xl border border-[#1f1f1f] bg-[#0f0f0f] text-sm text-gray-400">
              Loading real subscriber data…
            </div>
          ) : error ? (
            <div className="flex h-[620px] items-center justify-center rounded-2xl border border-[#3a1f1f] bg-[#140d0d] p-6 text-center text-sm text-red-300">
              {error}
            </div>
          ) : (
            <>
              <FanMap
                cityClusters={cityClusters}
                center={location}
                radiusKm={radiusKm}
                highlightedKeys={radiusResult.clusters.map(
                  (cluster) => `${cluster.city}-${cluster.country}`
                )}
              />

              <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
                <InfoCard>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Selected Audience
                  </p>
                  <p className="mt-3 text-4xl font-semibold text-white">
                    {radiusResult.totalContacts}
                  </p>
                  <p className="mt-2 text-sm text-gray-400">
                    contacts within {radiusKm} km of {location.label}
                  </p>
                </InfoCard>

                <InfoCard>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      Cities in Radius
                    </p>
                    <p className="text-xs text-gray-500">
                      {radiusResult.clusters.length} cities
                    </p>
                  </div>

                  {radiusResult.clusters.length === 0 ? (
                    <p className="mt-4 text-sm text-gray-500">
                      No cities found in this radius.
                    </p>
                  ) : (
                    <>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {topSelectedCities.map((cluster) => (
                          <div
                            key={`${cluster.city}-${cluster.country}`}
                            className="rounded-full border border-[#4a3d12] bg-[#2b2208] px-3 py-1.5 text-xs font-medium text-[#f0c94c]"
                          >
                            {cluster.city} ({cluster.count})
                          </div>
                        ))}
                      </div>

                      {radiusResult.clusters.length > topSelectedCities.length && (
                        <p className="mt-3 text-xs text-gray-500">
                          +{radiusResult.clusters.length - topSelectedCities.length} more
                        </p>
                      )}
                    </>
                  )}
                </InfoCard>

                <InfoCard>
                  <p className="text-xs uppercase tracking-wide text-gray-500">
                    Action
                  </p>
                  <p className="mt-3 text-sm text-gray-300">
                    Create a MailerLite group from this radius selection.
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    {location.label} · {radiusKm} km · {radiusResult.totalContacts} contacts
                  </p>
                  <p className="mt-1 text-xs text-gray-600">
                    {mailerLiteCount} subscribed (will be emailed)
                    {shopifyOnlyCount > 0
                      ? ` · ${shopifyOnlyCount} Shopify-only (not subscribed, excluded)`
                      : ""}
                  </p>

                  <button
                    onClick={handleCreateGroup}
                    disabled={creatingGroup || mailerLiteCount === 0}
                    className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#f0c94c] px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creatingGroup ? "Creating group..." : "Create MailerLite Group"}
                  </button>

                  <button
                    onClick={handleSaveAudience}
                    disabled={savingAudience}
                    className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-[#343434] px-4 py-3 text-sm font-semibold text-white transition hover:border-[#555] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingAudience ? "Saving..." : "Save Audience"}
                  </button>
                </InfoCard>
              </div>
            </>
          )}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white">Saved Audiences</h3>
          <p className="mt-1 text-sm text-gray-400">
            Save common radius selections so you can reload them instantly, on any device.
          </p>
        </div>

        {savedLoading ? (
          <div className="rounded-2xl border border-[#262626] bg-[#111] p-4 text-sm text-gray-500">
            Loading saved audiences…
          </div>
        ) : savedAudiences.length === 0 ? (
          <div className="rounded-2xl border border-[#262626] bg-[#111] p-4 text-sm text-gray-500">
            No saved audiences yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {savedAudiences.map((audience) => (
              <div
                key={audience.id}
                className="flex flex-col gap-3 rounded-2xl border border-[#262626] bg-[#111] p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium text-white">{audience.name}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {audience.city} · {audience.radiusKm} km
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleLoadAudience(audience)}
                    className="text-sm font-medium text-[#f0c94c]"
                  >
                    Load
                  </button>

                  <button
                    onClick={() => handleDeleteAudience(audience.id)}
                    className="text-sm font-medium text-red-400"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {data && (
        <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <SmallStat label="Source Rows" value={totalSourceRows.toLocaleString()} />
          <SmallStat label="Unique Contacts" value={(stats.uniqueContacts ?? summary.totalContacts).toLocaleString()} />
          <SmallStat label="Mapped Contacts" value={(stats.usableRows ?? summary.totalContacts).toLocaleString()} />
          <SmallStat label="Unique Cities" value={(stats.uniqueCities ?? summary.totalCities).toLocaleString()} />
        </section>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Top City Clusters</h3>
            <p className="mt-1 text-sm text-gray-400">
              Strongest pockets in your current mapped audience.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {cityClusters.slice(0, 6).map((cluster) => (
            <div
              key={`${cluster.city}-${cluster.country}`}
              className="rounded-2xl border border-[#262626] bg-[#111] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-white">
                    {cluster.city}, {cluster.country}
                  </p>
                  <p className="mt-1 text-sm text-gray-400">
                    {cluster.count} contact{cluster.count === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="rounded-full border border-[#4a3d12] bg-[#2b2208] px-3 py-1 text-xs font-medium text-[#f0c94c]">
                  {cluster.shareOfAudience.toFixed(1)}%
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function getAudienceSummaryFromClusters(cityClusters: (CityCluster & { emails?: string[] })[]) {
  const totalContacts = cityClusters.reduce((sum, cluster) => sum + cluster.count, 0);
  const totalCities = cityClusters.length;
  const largestCluster = cityClusters[0] ?? null;

  const countryMap = new Map<string, number>();
  for (const cluster of cityClusters) {
    countryMap.set(cluster.country, (countryMap.get(cluster.country) || 0) + cluster.count);
  }

  const topCountryEntry = Array.from(countryMap.entries()).sort((a, b) => b[1] - a[1])[0];

  return {
    totalContacts,
    totalCities,
    largestCluster,
    topCountry: topCountryEntry
      ? { country: topCountryEntry[0], count: topCountryEntry[1] }
      : null,
  };
}

function formatShowDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function ControlField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-[0.16em] text-gray-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#262626] bg-[#111] p-5">
      <p className="text-sm text-gray-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
    </div>
  );
}

function SmallStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-[#262626] bg-[#111] p-4">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#262626] bg-[#0d0d0d] p-4">
      {children}
    </div>
  );
}
