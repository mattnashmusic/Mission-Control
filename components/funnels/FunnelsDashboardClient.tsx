"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { FunnelDailyPoint, FunnelPageStats } from "@/lib/funnel-data";

const CHART_DAY_WIDTH = 64;

// Categorical palette (dark-surface slots 1 & 2), fixed order — validated
// for CVD-safe adjacency (ΔE 26.8 protan / 31.8 normal-vision on #1a1a19).
const COLOR_VIEWS = "#3987e5";
const COLOR_CLICKS = "#d95926";

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

function ChartLegend() {
  return (
    <div className="mb-3 flex items-center gap-4 text-xs text-zinc-400">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-2.5 w-2.5 rounded-sm"
          style={{ backgroundColor: COLOR_VIEWS }}
        />
        Views
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="h-2.5 w-2.5 rounded-sm"
          style={{ backgroundColor: COLOR_CLICKS }}
        />
        Clicks
      </span>
    </div>
  );
}

function DailyFunnelChart({ daily }: { daily: FunnelDailyPoint[] }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const maxValue = Math.max(
    ...daily.map((point) => Math.max(point.views, point.clicks)),
    0
  );

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
      <ChartLegend />
      <div ref={scrollRef} className="overflow-x-auto pb-2">
        <div className="flex h-40 items-end gap-2">
          {daily.map((point) => {
            const viewHeight =
              maxValue === 0 || point.views === 0
                ? 0
                : Math.max((point.views / maxValue) * 100, 6);
            const clickHeight =
              maxValue === 0 || point.clicks === 0
                ? 0
                : Math.max((point.clicks / maxValue) * 100, 6);
            const isHovered = hoveredDate === point.date;

            return (
              <div
                key={point.date}
                className="flex shrink-0 flex-col items-center justify-end gap-1"
                style={{ width: CHART_DAY_WIDTH }}
                onMouseEnter={() => setHoveredDate(point.date)}
                onMouseLeave={() =>
                  setHoveredDate((current) =>
                    current === point.date ? null : current
                  )
                }
              >
                <div className="relative flex h-24 w-full items-end justify-center gap-[3px] rounded-lg bg-zinc-900/80 p-1">
                  {isHovered && (
                    <div className="pointer-events-none absolute -top-[4.25rem] left-1/2 z-10 w-max -translate-x-1/2 rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-[10px] leading-relaxed text-zinc-200 shadow-lg">
                      <div className="font-medium text-zinc-400">
                        {formatChartDate(point.date)}
                      </div>
                      <div style={{ color: COLOR_VIEWS }}>
                        {point.views} views
                      </div>
                      <div style={{ color: COLOR_CLICKS }}>
                        {point.clicks} clicks
                      </div>
                    </div>
                  )}
                  <div
                    className="w-full rounded-t-[4px] transition-opacity"
                    style={{
                      height: `${viewHeight}%`,
                      backgroundColor: COLOR_VIEWS,
                      opacity: isHovered ? 1 : 0.85,
                    }}
                  />
                  <div
                    className="w-full rounded-t-[4px] transition-opacity"
                    style={{
                      height: `${clickHeight}%`,
                      backgroundColor: COLOR_CLICKS,
                      opacity: isHovered ? 1 : 0.85,
                    }}
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

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 20 20"
      fill="currentColor"
      className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform duration-150 ${
        open ? "rotate-90 text-zinc-300" : ""
      }`}
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 010-1.06L11.94 8 7.21 3.29a.75.75 0 111.06-1.06l5.25 5.25a.75.75 0 010 1.06l-5.25 5.25a.75.75 0 01-1.06 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function TourFunnelTable({ pages }: { pages: FunnelPageStats[] }) {
  const [expandedSlug, setExpandedSlug] = useState<string | null>(null);

  if (pages.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/50 text-sm text-zinc-500">
        No pages configured for this section yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/90">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-xs uppercase tracking-[0.15em] text-zinc-500">
            <th className="px-5 py-3 font-medium">Show</th>
            <th className="px-5 py-3 text-right font-medium">Page Views</th>
            <th className="px-5 py-3 text-right font-medium">Click Thrus</th>
            <th className="px-5 py-3 text-right font-medium">Conversion</th>
          </tr>
        </thead>
        <tbody>
          {pages.map((page) => {
            const isOpen = expandedSlug === page.slug;
            return (
              <Fragment key={page.slug}>
                <tr
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setExpandedSlug((current) =>
                      current === page.slug ? null : page.slug
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    setExpandedSlug((current) =>
                      current === page.slug ? null : page.slug
                    );
                  }}
                  className="cursor-pointer border-b border-zinc-800/60 last:border-b-0 transition hover:bg-zinc-800/40"
                >
                  <td className="px-5 py-4 font-medium text-white">
                    <span className="flex items-center gap-2">
                      <ChevronIcon open={isOpen} />
                      {page.name}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right text-zinc-200">
                    {page.views}
                  </td>
                  <td className="px-5 py-4 text-right text-zinc-200">
                    {page.clicks}
                  </td>
                  <td className="px-5 py-4 text-right text-zinc-200">
                    {percent(page.conversionRate)}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-b border-zinc-800/60 bg-zinc-950/30 last:border-b-0">
                    <td colSpan={4} className="px-5 py-4">
                      <DailyFunnelChart daily={page.daily} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function FunnelSection({
  title,
  emoji,
  description,
  pages,
  variant,
}: {
  title: string;
  emoji: string;
  description: string;
  pages: FunnelPageStats[];
  variant: "cards" | "table";
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

      {variant === "table" ? (
        <TourFunnelTable pages={pages} />
      ) : pages.length === 0 ? (
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
          variant="cards"
        />

        <FunnelSection
          title="Tour"
          emoji="🌎"
          description="Ticket bridge pages between the Meta ad and the ticket seller."
          pages={tour}
          variant="table"
        />
      </div>
    </main>
  );
}
