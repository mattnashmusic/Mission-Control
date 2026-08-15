"use client";

import { useEffect, useMemo, useRef } from "react";
import type { FunnelDailyPoint, FunnelPageStats } from "@/lib/funnel-data";

const CHART_DAY_WIDTH = 56;

function percent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatChartDate(dateString: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${dateString}T00:00:00`));
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 px-4 py-3">
      <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}

function DailyFunnelChart({ daily }: { daily: FunnelDailyPoint[] }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const maxViews = Math.max(...daily.map((point) => point.views), 0);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    scrollElement.scrollLeft = scrollElement.scrollWidth;
  }, [daily.length]);

  if (daily.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/50 text-sm text-zinc-500">
        No page views recorded yet.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
      <div ref={scrollRef} className="overflow-x-auto pb-2">
        <div className="flex h-40 items-end gap-2">
          {daily.map((point) => {
            const heightPercent =
              maxViews === 0
                ? 0
                : point.views === 0
                  ? 0
                  : Math.max((point.views / maxViews) * 100, 8);

            return (
              <div
                key={point.date}
                className="flex shrink-0 flex-col items-center justify-end gap-1"
                style={{ width: CHART_DAY_WIDTH }}
                title={`${formatChartDate(point.date)}: ${point.views} views, ${point.clicks} clicks`}
              >
                <div className="text-[10px] font-medium text-zinc-300">
                  {point.views === 0 ? "" : point.views}
                </div>

                <div className="flex h-24 w-full items-end rounded-lg bg-zinc-900/80 p-1">
                  <div
                    className="w-full rounded-md bg-emerald-400/80 transition hover:bg-emerald-300"
                    style={{ height: `${heightPercent}%` }}
                  />
                </div>

                <div className="text-center text-[10px] text-zinc-500">
                  {formatChartDate(point.date)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FunnelPageCard({ page }: { page: FunnelPageStats }) {
  return (
    <div className="mb-5 rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h3 className="text-xl font-semibold text-white">{page.name}</h3>

        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Page Views" value={String(page.views)} />
          <StatTile label="Click Thrus" value={String(page.clicks)} />
          <StatTile label="Conversion" value={percent(page.conversionRate)} />
        </div>
      </div>

      <DailyFunnelChart daily={page.daily} />
    </div>
  );
}

function FunnelSection({
  title,
  emoji,
  description,
  pages,
}: {
  title: string;
  emoji: string;
  description: string;
  pages: FunnelPageStats[];
}) {
  const totals = useMemo(() => {
    const views = pages.reduce((sum, page) => sum + page.views, 0);
    const clicks = pages.reduce((sum, page) => sum + page.clicks, 0);
    const conversionRate = views > 0 ? (clicks / views) * 100 : 0;
    return { views, clicks, conversionRate };
  }, [pages]);

  return (
    <section className="mb-10">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">
            {emoji} {title}
          </h2>
          <p className="mt-1 text-sm text-zinc-400">{description}</p>
        </div>

        <div className="grid grid-cols-3 gap-3 text-right">
          <StatTile label="Total Views" value={String(totals.views)} />
          <StatTile label="Total Clicks" value={String(totals.clicks)} />
          <StatTile
            label="Conversion"
            value={percent(totals.conversionRate)}
          />
        </div>
      </div>

      {pages.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/50 text-sm text-zinc-500">
          No pages configured for this section yet.
        </div>
      ) : (
        pages.map((page) => <FunnelPageCard key={page.slug} page={page} />)
      )}
    </section>
  );
}

export default function FunnelsDashboardClient({
  releases,
  tour,
}: {
  releases: FunnelPageStats[];
  tour: FunnelPageStats[];
}) {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-6xl px-2 py-2">
        <header className="mb-10">
          <p className="mb-2 text-sm uppercase tracking-[0.35em] text-zinc-500">
            Mission Control
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            🔻 Funnels
          </h1>
          <p className="mt-2 text-zinc-400">
            Page views, click-throughs, and conversion rate across release
            and tour bridge pages.
          </p>
        </header>

        <FunnelSection
          title="Releases"
          emoji="🎧"
          description="Spotify smart-link bridge pages."
          pages={releases}
        />

        <FunnelSection
          title="Tour"
          emoji="🌎"
          description="Ticket bridge pages between the Meta ad and the ticket seller."
          pages={tour}
        />
      </div>
    </main>
  );
}
