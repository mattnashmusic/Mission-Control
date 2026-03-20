"use client";

import { useEffect, useMemo, useState } from "react";
import FanMap from "@/components/email/FanMap";
import { getAudienceInRadius, type CityCluster } from "@/lib/email/audience";
import {
  getSavedAudiences,
  saveAudience,
  deleteAudience,
  type SavedAudience,
} from "@/lib/email/savedAudiences";

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Amsterdam: { lat: 52.3676, lng: 4.9041 },
  Berlin: { lat: 52.52, lng: 13.405 },
  Brussels: { lat: 50.8503, lng: 4.3517 },
  Cologne: { lat: 50.9375, lng: 6.9603 },
  Hamburg: { lat: 53.5511, lng: 9.9937 },
  London: { lat: 51.5072, lng: -0.1276 },
  Munich: { lat: 48.1351, lng: 11.582 },
  Paris: { lat: 48.8566, lng: 2.3522 },
  Utrecht: { lat: 52.0907, lng: 5.1214 },
  Zurich: { lat: 47.3769, lng: 8.5417 },
};

type AudienceApiResponse = {
  clusters: (CityCluster & { emails?: string[] })[];
  stats: {
    totalRows: number;
    usableRows: number;
    skippedRows: number;
    uniqueCities: number;
  };
};

export default function EmailPage() {
  const [selectedCity, setSelectedCity] = useState("Berlin");
  const [radiusKm, setRadiusKm] = useState(100);
  const [data, setData] = useState<AudienceApiResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [savedAudiences, setSavedAudiences] = useState<SavedAudience[]>([]);

  useEffect(() => {
    setSavedAudiences(getSavedAudiences());
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

  const cityClusters = data?.clusters ?? [];
  const summary = useMemo(() => getAudienceSummaryFromClusters(cityClusters), [cityClusters]);
  const center = CITY_COORDS[selectedCity];

  const radiusResult = useMemo(() => {
    return getAudienceInRadius(cityClusters, center.lat, center.lng, radiusKm);
  }, [cityClusters, center.lat, center.lng, radiusKm]);

  const topSelectedCities = radiusResult.clusters.slice(0, 8);

  async function handleCreateGroup() {
    try {
      setCreatingGroup(true);

      const emails = radiusResult.clusters.flatMap(
  (cluster: any) => cluster.emails ?? []
);

      const response = await fetch("/api/email/create-group", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: `${selectedCity} ${radiusKm}km`,
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

  function handleSaveAudience() {
    const newAudience: SavedAudience = {
      id: crypto.randomUUID(),
      name: `${selectedCity} ${radiusKm}km`,
      city: selectedCity,
      radiusKm,
      createdAt: Date.now(),
    };

    saveAudience(newAudience);
    setSavedAudiences(getSavedAudiences());
  }

  function handleLoadAudience(audience: SavedAudience) {
    setSelectedCity(audience.city);
    setRadiusKm(audience.radiusKm);
  }

  function handleDeleteAudience(id: string) {
    deleteAudience(id);
    setSavedAudiences(getSavedAudiences());
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

      <section className="overflow-hidden rounded-3xl border border-[#262626] bg-[#111]">
        <div className="border-b border-[#202020] px-5 py-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Audience Map</h2>
              <p className="mt-1 text-sm text-gray-400">
                Choose a city and radius to see who is nearby.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <ControlField label="City">
                <select
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="min-w-[140px] rounded-xl border border-[#343434] bg-[#161616] px-3 py-2 text-sm text-white outline-none transition hover:border-[#4a4a4a]"
                >
                  {Object.keys(CITY_COORDS).map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
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
                center={center}
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
                    contacts within {radiusKm} km of {selectedCity}
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
                    {selectedCity} · {radiusKm} km · {radiusResult.totalContacts} contacts
                  </p>

                  <button
                    onClick={handleCreateGroup}
                    disabled={creatingGroup || radiusResult.totalContacts === 0}
                    className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#f0c94c] px-4 py-3 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creatingGroup ? "Creating group..." : "Create MailerLite Group"}
                  </button>

                  <button
                    onClick={handleSaveAudience}
                    className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-[#343434] px-4 py-3 text-sm font-semibold text-white transition hover:border-[#555]"
                  >
                    Save Audience
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
            Save common radius selections so you can reload them instantly.
          </p>
        </div>

        {savedAudiences.length === 0 ? (
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
          <SmallStat label="CSV Rows" value={data.stats.totalRows.toLocaleString()} />
          <SmallStat label="Mapped Rows" value={data.stats.usableRows.toLocaleString()} />
          <SmallStat label="Skipped Rows" value={data.stats.skippedRows.toLocaleString()} />
          <SmallStat label="Unique Cities" value={data.stats.uniqueCities.toLocaleString()} />
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