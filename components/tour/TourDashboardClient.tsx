"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { saveShowField, type EditableShowField } from "@/lib/show-client";
import {
  saveTourSetting,
  type EditableTourSettingField,
} from "@/lib/tour-settings-client";

const META_CPT_START_DATE = "2026-06-15";

export type DailyTicketSalesPoint = {
  date: string;
  label: string;
  ticketSales: number;
  ticketRevenue: number;
};

export type TourShow = {
  id: string;
  slug: string;
  date: string;
  city: string;
  country: string;
  venue: string;
  capacity: number;
  ticketPrice: number;
  ticketSales: number;
  ticketRevenue: number;
  dailyTicketSales: DailyTicketSalesPoint[];
  metaSpend: number;
  notes?: string | null;
  costs: {
    venueHire: number;
    production: number;
    hotelPetrolMisc: number;
  };
};

type TourSettings = {
  plannedAdBudget: number;
  blendedCpt: number;
};

type SaveState = "idle" | "saving" | "saved" | "error";

function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function signedMoney(value: number) {
  if (value > 0) return `+${money(value)}`;
  if (value < 0) return `-${money(Math.abs(value))}`;
  return money(0);
}

function percent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(dateString));
}

function formatChartDate(dateString: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${dateString}T00:00:00`));
}


const CHART_DAY_WIDTH = 72;
const CAMPAIGN_WEEK_START_DATE = META_CPT_START_DATE;

function dateKey(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function parseDateKey(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(dateString: string, days: number) {
  const date = parseDateKey(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

function daysBetween(startDateString: string, endDateString: string) {
  const startDate = parseDateKey(startDateString);
  const endDate = parseDateKey(endDateString);
  return Math.floor(
    (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  );
}

function getCampaignWeekNumber(dateString: string) {
  const diff = daysBetween(CAMPAIGN_WEEK_START_DATE, dateString);
  return Math.floor(Math.max(diff, 0) / 7) + 1;
}

type WeeklyTicketSalesPoint = {
  weekStart: string;
  label: string;
  weeklySales: number;
  cumulativeSales: number;
  weeklyRevenue: number;
  cumulativeRevenue: number;
};

function formatWeekLabel(dateString: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${dateString}T00:00:00`));
}

function getMondayWeekStart(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayOfWeek = date.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  date.setUTCDate(date.getUTCDate() - daysSinceMonday);

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function buildWeeklyTicketSales(
  dailyTicketSales: DailyTicketSalesPoint[]
): WeeklyTicketSalesPoint[] {
  const weeklySalesByStart = new Map<
    string,
    {
      weeklySales: number;
      weeklyRevenue: number;
    }
  >();

  dailyTicketSales.forEach((point) => {
    const weekStart = getMondayWeekStart(point.date);
    const existing = weeklySalesByStart.get(weekStart) ?? {
      weeklySales: 0,
      weeklyRevenue: 0,
    };

    existing.weeklySales += point.ticketSales;
    existing.weeklyRevenue += point.ticketRevenue;

    weeklySalesByStart.set(weekStart, existing);
  });

  let cumulativeSales = 0;
  let cumulativeRevenue = 0;

  return Array.from(weeklySalesByStart.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, value]) => {
      cumulativeSales += value.weeklySales;
      cumulativeRevenue += value.weeklyRevenue;

      return {
        weekStart,
        label: formatWeekLabel(weekStart),
        weeklySales: value.weeklySales,
        cumulativeSales,
        weeklyRevenue: value.weeklyRevenue,
        cumulativeRevenue,
      };
    });
}

function WeeklySalesProgressCard({ show }: { show: TourShow }) {
  const weeklySales = buildWeeklyTicketSales(show.dailyTicketSales);
  const bestWeek = weeklySales.reduce(
    (best, week) => Math.max(best, week.weeklySales),
    0
  );
  const latestWeek = weeklySales[weeklySales.length - 1];

  if (weeklySales.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h3 className="text-lg font-semibold text-white">
          Weekly Sales Progress
        </h3>
        <div className="mt-4 rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/50 p-6 text-sm text-zinc-500">
          No weekly sales data yet. For Eventbrite shows this will populate from
          attendee purchase dates. Nijmegen can stay manual until we add the
          Monday update table.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">
            Weekly Sales Progress
          </h3>
          <p className="mt-1 text-sm text-zinc-400">
            Monday-to-Sunday ticket movement for this show.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-right">
          <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            Latest Week
          </div>
          <div className="mt-1 text-xl font-semibold text-emerald-400">
            +{latestWeek?.weeklySales ?? 0}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {weeklySales.map((week) => {
          const width =
            bestWeek === 0 ? 0 : Math.max((week.weeklySales / bestWeek) * 100, 4);

          return (
            <div key={week.weekStart} className="grid gap-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <div className="font-medium text-zinc-200">{week.label}</div>
                <div className="text-zinc-400">
                  <span className="font-semibold text-emerald-400">
                    +{week.weeklySales}
                  </span>
                  <span className="mx-2 text-zinc-600">/</span>
                  <span>{week.cumulativeSales} total</span>
                </div>
              </div>

              <div className="h-3 overflow-hidden rounded-full bg-zinc-950">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-800/70 text-zinc-300">
            <tr>
              <th className="px-4 py-3 font-medium">Week</th>
              <th className="px-4 py-3 text-right font-medium">UP</th>
              <th className="px-4 py-3 text-right font-medium">Total Sold</th>
              <th className="px-4 py-3 text-right font-medium">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {weeklySales.map((week) => (
              <tr key={week.weekStart} className="border-t border-zinc-800">
                <td className="px-4 py-3 text-zinc-300">{week.label}</td>
                <td className="px-4 py-3 text-right font-semibold text-emerald-400">
                  +{week.weeklySales}
                </td>
                <td className="px-4 py-3 text-right text-zinc-300">
                  {week.cumulativeSales}
                </td>
                <td className="px-4 py-3 text-right text-zinc-300">
                  {money(week.weeklyRevenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function calculateCampaignTickets(show: TourShow) {
  const campaignTicketsFromDailySales = show.dailyTicketSales
    .filter((point) => point.date >= META_CPT_START_DATE)
    .reduce((sum, point) => sum + point.ticketSales, 0);

  if (campaignTicketsFromDailySales > 0) {
    return campaignTicketsFromDailySales;
  }

  return show.ticketSales;
}

function calculateShowTotalCost(show: TourShow) {
  return (
    show.costs.venueHire +
    show.costs.production +
    show.costs.hotelPetrolMisc +
    show.metaSpend
  );
}

function calculateShowBaseCostExcludingAds(show: TourShow) {
  return (
    show.costs.venueHire +
    show.costs.production +
    show.costs.hotelPetrolMisc
  );
}

function calculateBreakEvenTickets(show: TourShow) {
  if (show.ticketPrice === 0) return 0;
  return calculateShowTotalCost(show) / show.ticketPrice;
}

function calculateRevenue(show: TourShow) {
  return show.ticketRevenue;
}

function calculateProfitLoss(show: TourShow) {
  return calculateRevenue(show) - calculateShowTotalCost(show);
}

function calculatePercentSold(show: TourShow) {
  if (show.capacity === 0) return 0;
  return (show.ticketSales / show.capacity) * 100;
}

function calculateCostPerTicket(show: TourShow) {
  const campaignTickets = calculateCampaignTickets(show);

  if (campaignTickets === 0) return 0;

  return show.metaSpend / campaignTickets;
}

function KpiCard({
  title,
  value,
  valueClassName = "text-white",
}: {
  title: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5">
      <div className="text-base font-semibold text-zinc-200">{title}</div>
      <div className={`mt-2 text-3xl font-semibold tracking-tight ${valueClassName}`}>
        {value}
      </div>
    </div>
  );
}

type CampaignWeekChartGroup = {
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
  ticketSales: number;
  ticketRevenue: number;
};

function buildContinuousChartData(data: DailyTicketSalesPoint[]) {
  const campaignData = data.filter((point) => point.date >= CAMPAIGN_WEEK_START_DATE);

  if (campaignData.length === 0) return [];

  const latestDate = campaignData.reduce((latest, point) => {
    return point.date > latest ? point.date : latest;
  }, CAMPAIGN_WEEK_START_DATE);

  const salesByDate = new Map(campaignData.map((point) => [point.date, point]));
  const totalDays = daysBetween(CAMPAIGN_WEEK_START_DATE, latestDate);

  return Array.from({ length: totalDays + 1 }, (_, index) => {
    const date = addDays(CAMPAIGN_WEEK_START_DATE, index);
    const existing = salesByDate.get(date);

    return {
      date,
      label: formatChartDate(date),
      ticketSales: existing?.ticketSales ?? 0,
      ticketRevenue: existing?.ticketRevenue ?? 0,
    };
  });
}

function buildCampaignWeekGroups(
  data: DailyTicketSalesPoint[]
): CampaignWeekChartGroup[] {
  const chartData = buildContinuousChartData(data);
  const groups = new Map<number, CampaignWeekChartGroup>();

  chartData.forEach((point) => {
    const weekNumber = getCampaignWeekNumber(point.date);
    const weekStart = addDays(CAMPAIGN_WEEK_START_DATE, (weekNumber - 1) * 7);
    const weekEnd = addDays(weekStart, 6);
    const existing = groups.get(weekNumber) ?? {
      weekNumber,
      weekStart,
      weekEnd,
      ticketSales: 0,
      ticketRevenue: 0,
    };

    existing.ticketSales += point.ticketSales;
    existing.ticketRevenue += point.ticketRevenue;

    groups.set(weekNumber, existing);
  });

  return Array.from(groups.values()).sort(
    (a, b) => a.weekNumber - b.weekNumber
  );
}

function DailyTicketSalesChart({
  data,
}: {
  data: DailyTicketSalesPoint[];
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const chartData = useMemo(() => buildContinuousChartData(data), [data]);
  const weeklyGroups = useMemo(() => buildCampaignWeekGroups(data), [data]);
  const maxTickets = Math.max(...chartData.map((point) => point.ticketSales), 0);
  const totalTickets = chartData.reduce((sum, point) => sum + point.ticketSales, 0);
  const totalRevenue = chartData.reduce((sum, point) => sum + point.ticketRevenue, 0);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    scrollElement.scrollLeft = scrollElement.scrollWidth;
  }, [chartData.length]);

  return (
    <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Daily Ticket Sales</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Ticket sales from 15 Jun onwards. Scroll left to view older dates.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-right">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Tickets 15 Jun+</div>
            <div className="mt-1 text-xl font-semibold text-white">{totalTickets}</div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 px-4 py-3">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Revenue 15 Jun+</div>
            <div className="mt-1 text-xl font-semibold text-white">{money(totalRevenue)}</div>
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex h-64 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/50 text-sm text-zinc-500">
          No ticket sales data from 15 Jun onwards yet.
        </div>
      ) : (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
          <div ref={scrollRef} className="overflow-x-auto pb-3">
            <div className="min-w-max">
              <div className="flex h-72 items-end gap-3">
                {chartData.map((point) => {
                  const heightPercent =
                    maxTickets === 0
                      ? 0
                      : point.ticketSales === 0
                        ? 0
                        : Math.max((point.ticketSales / maxTickets) * 100, 8);

                  return (
                    <div
                      key={point.date}
                      className="flex shrink-0 flex-col items-center justify-end gap-2"
                      style={{ width: CHART_DAY_WIDTH }}
                      title={`${formatChartDate(point.date)}: ${point.ticketSales} tickets, ${money(
                        point.ticketRevenue
                      )}`}
                    >
                      <div className="text-xs font-medium text-zinc-300">
                        {point.ticketSales === 0 ? "" : point.ticketSales}
                      </div>

                      <div className="flex h-48 w-full items-end rounded-xl bg-zinc-900/80 p-1">
                        <div
                          className="w-full rounded-lg bg-emerald-400/80 transition hover:bg-emerald-300"
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>

                      <div className="text-center text-xs text-zinc-500">
                        {formatChartDate(point.date)}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex gap-3">
                {weeklyGroups.map((week) => {
                  const weekWidth = CHART_DAY_WIDTH * 7 + 12 * 6;

                  return (
                    <div
                      key={week.weekNumber}
                      className="rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-center"
                      style={{ width: weekWidth }}
                      title={`${formatChartDate(week.weekStart)} - ${formatChartDate(
                        week.weekEnd
                      )}: ${week.ticketSales} tickets`}
                    >
                      <div className="text-sm font-semibold text-emerald-400">
                        Week {week.weekNumber} - {week.ticketSales} tickets
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {formatChartDate(week.weekStart)} - {formatChartDate(week.weekEnd)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function TourDashboardClient({
  initialShows,
  initialSettings,
}: {
  initialShows: TourShow[];
  initialSettings: TourSettings;
}) {
  const [shows, setShows] = useState<TourShow[]>(initialShows);
  const [expandedShowId, setExpandedShowId] = useState<string | null>(null);
  const [tourEconomicsOpen, setTourEconomicsOpen] = useState(false);
  const [plannedAdBudget, setPlannedAdBudget] = useState<number>(
    initialSettings.plannedAdBudget
  );
  const [blendedCpt, setBlendedCpt] = useState<number>(
    initialSettings.blendedCpt
  );
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [settingsSaveStates, setSettingsSaveStates] = useState<
    Record<EditableTourSettingField, SaveState>
  >({
    plannedAdBudget: "idle",
    blendedCpt: "idle",
  });

  const kpis = useMemo(() => {
    const upcomingShows = shows.length;
    const ticketsSoldTotal = shows.reduce((sum, show) => sum + show.ticketSales, 0);
    const campaignTicketsTotal = shows.reduce(
      (sum, show) => sum + calculateCampaignTickets(show),
      0
    );
    const totalCapacity = shows.reduce((sum, show) => sum + show.capacity, 0);
    const adSpendTotal = shows.reduce((sum, show) => sum + show.metaSpend, 0);
    const totalRevenue = shows.reduce(
      (sum, show) => sum + calculateRevenue(show),
      0
    );
    const percentTourSold =
      totalCapacity === 0 ? 0 : (ticketsSoldTotal / totalCapacity) * 100;
    const costPerTicket =
      campaignTicketsTotal === 0 ? 0 : adSpendTotal / campaignTicketsTotal;

    const totalTourBaseCosts = shows.reduce(
      (sum, show) => sum + calculateShowBaseCostExcludingAds(show),
      0
    );

    const totalTourCosts = totalTourBaseCosts + plannedAdBudget;

    const weightedAverageTicketPrice =
      totalCapacity === 0
        ? 0
        : shows.reduce((sum, show) => sum + show.capacity * show.ticketPrice, 0) /
          totalCapacity;

    const forecastTicketsSold =
      blendedCpt === 0 ? 0 : plannedAdBudget / blendedCpt;

    const expectedRevenue = forecastTicketsSold * weightedAverageTicketPrice;

    const forecastProfit = expectedRevenue - totalTourCosts;

    return {
      upcomingShows,
      ticketsSoldTotal,
      campaignTicketsTotal,
      adSpendTotal,
      totalRevenue,
      percentTourSold,
      costPerTicket,
      totalTourBaseCosts,
      totalTourCosts,
      weightedAverageTicketPrice,
      forecastTicketsSold,
      expectedRevenue,
      forecastProfit,
    };
  }, [shows, plannedAdBudget, blendedCpt]);

  const dailyTicketSales = useMemo(() => {
    const salesByDate = new Map<string, DailyTicketSalesPoint>();

    shows.forEach((show) => {
      show.dailyTicketSales.forEach((point) => {
        const existing = salesByDate.get(point.date);

        if (existing) {
          existing.ticketSales += point.ticketSales;
          existing.ticketRevenue += point.ticketRevenue;
          return;
        }

        salesByDate.set(point.date, { ...point });
      });
    });

    return Array.from(salesByDate.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((point) => ({
        ...point,
        label: formatChartDate(point.date),
      }));
  }, [shows]);

  function updateShow(
    showId: string,
    updater: (current: TourShow) => TourShow
  ) {
    setShows((current) =>
      current.map((show) => (show.id === showId ? updater(show) : show))
    );
  }

  function getSaveKey(showId: string, field: EditableShowField) {
    return `${showId}:${field}`;
  }

  async function persistField(
    showId: string,
    field: EditableShowField,
    value: number
  ) {
    const key = getSaveKey(showId, field);

    try {
      setSaveStates((prev) => ({ ...prev, [key]: "saving" }));
      await saveShowField(showId, field, value);
      setSaveStates((prev) => ({ ...prev, [key]: "saved" }));

      setTimeout(() => {
        setSaveStates((prev) => {
          const next = { ...prev };
          if (next[key] === "saved") {
            delete next[key];
          }
          return next;
        });
      }, 1500);
    } catch (error) {
      console.error(error);
      setSaveStates((prev) => ({ ...prev, [key]: "error" }));
    }
  }

  async function persistSetting(
    field: EditableTourSettingField,
    value: number
  ) {
    try {
      setSettingsSaveStates((prev) => ({ ...prev, [field]: "saving" }));
      await saveTourSetting(field, value);
      setSettingsSaveStates((prev) => ({ ...prev, [field]: "saved" }));

      setTimeout(() => {
        setSettingsSaveStates((prev) => {
          if (prev[field] !== "saved") return prev;
          return { ...prev, [field]: "idle" };
        });
      }, 1500);
    } catch (error) {
      console.error(error);
      setSettingsSaveStates((prev) => ({ ...prev, [field]: "error" }));
    }
  }

  function renderSaveStatus(showId: string, field: EditableShowField) {
    const state = saveStates[getSaveKey(showId, field)];

    if (state === "saving") {
      return <div className="text-xs text-zinc-500">Saving...</div>;
    }

    if (state === "saved") {
      return <div className="text-xs text-emerald-400">Saved</div>;
    }

    if (state === "error") {
      return <div className="text-xs text-rose-400">Failed to save</div>;
    }

    return <div className="text-xs text-transparent">.</div>;
  }

  function renderSettingSaveStatus(field: EditableTourSettingField) {
    const state = settingsSaveStates[field];

    if (state === "saving") {
      return <div className="text-xs text-zinc-500">Saving...</div>;
    }

    if (state === "saved") {
      return <div className="text-xs text-emerald-400">Saved</div>;
    }

    if (state === "error") {
      return <div className="text-xs text-rose-400">Failed to save</div>;
    }

    return <div className="text-xs text-transparent">.</div>;
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-[1600px] px-6 py-10">
        <header className="mb-10">
          <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
            Mission Control
          </p>
          <h1 className="text-5xl font-semibold tracking-tight text-white">
            🌎 Tour Dashboard
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-zinc-400">
            Track ticket sales, ad spend, show costs, and profitability across the tour.
          </p>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <KpiCard title="🎫 Upcoming Shows" value={String(kpis.upcomingShows)} />
          <KpiCard title="📈 Total Tickets Sold" value={String(kpis.ticketsSoldTotal)} />
          <KpiCard title="💰 Total Revenue" value={money(kpis.totalRevenue)} />
          <KpiCard title="% of Tour Sold" value={percent(kpis.percentTourSold)} />
          <KpiCard title="📣 Ad Spend" value={money(kpis.adSpendTotal)} />
          <KpiCard
            title="💸 Cost Per Ticket"
            value={kpis.campaignTicketsTotal === 0 ? "—" : money(kpis.costPerTicket)}
          />
        </section>

        <DailyTicketSalesChart data={dailyTicketSales} />

        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5">
          <div className="mb-4">
            <h2 className="text-2xl font-semibold text-white">Shows</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Click a row to expand show details, edit costs, and review profitability.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-800/70 text-zinc-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">City</th>
                  <th className="px-4 py-3 font-medium">Venue</th>
                  <th className="px-4 py-3 text-right font-medium">Tickets Sold</th>
                  <th className="px-4 py-3 text-right font-medium">Revenue</th>
                  <th className="px-4 py-3 text-right font-medium">Capacity</th>
                  <th className="px-4 py-3 text-right font-medium">% Sold</th>
                  <th className="px-4 py-3 text-right font-medium">Ad Spend</th>
                  <th className="px-4 py-3 text-right font-medium">Cost / Ticket 15 Jun+</th>
                </tr>
              </thead>

              <tbody>
                {shows.map((show) => {
                  const isExpanded = expandedShowId === show.id;
                  const percentSold = calculatePercentSold(show);
                  const campaignTickets = calculateCampaignTickets(show);
                  const costPerTicket = calculateCostPerTicket(show);
                  const totalCost = calculateShowTotalCost(show);
                  const breakEvenTickets = calculateBreakEvenTickets(show);
                  const revenue = calculateRevenue(show);
                  const profitLoss = calculateProfitLoss(show);

                  return (
                    <React.Fragment key={show.id}>
                      <tr
                        className="cursor-pointer border-t border-zinc-800 transition hover:bg-zinc-900/80"
                        onClick={() =>
                          setExpandedShowId(isExpanded ? null : show.id)
                        }
                      >
                        <td className="px-4 py-4">{formatDate(show.date)}</td>
                        <td className="px-4 py-4">{show.city}</td>
                        <td className="px-4 py-4 text-zinc-300">{show.venue}</td>
                        <td className="px-4 py-4 text-right">{show.ticketSales}</td>
                        <td className="px-4 py-4 text-right font-medium text-emerald-400">
                          {money(revenue)}
                        </td>
                        <td className="px-4 py-4 text-right text-zinc-400">
                          {show.capacity}
                        </td>
                        <td className="px-4 py-4 text-right">{percent(percentSold)}</td>
                        <td className="px-4 py-4 text-right">{money(show.metaSpend)}</td>
                        <td className="px-4 py-4 text-right">
                          {campaignTickets === 0 ? "—" : money(costPerTicket)}
                        </td>
                      </tr>

                      {isExpanded ? (
                        <tr className="border-t border-zinc-800 bg-zinc-950/50">
                          <td colSpan={9} className="px-5 py-5">
                            <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
                              <div className="space-y-5">
                                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                                  <h3 className="text-lg font-semibold text-white">
                                    Show Snapshot
                                  </h3>

                                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                                    <div>
                                      <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                                        Tickets Sold
                                      </div>
                                      <div className="mt-2 text-2xl font-semibold text-white">
                                        {show.ticketSales}
                                      </div>
                                    </div>

                                    <div>
                                      <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                                        Tickets 15 Jun+
                                      </div>
                                      <div className="mt-2 text-2xl font-semibold text-white">
                                        {campaignTickets}
                                      </div>
                                    </div>

                                    <div>
                                      <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                                        Revenue
                                      </div>
                                      <div className="mt-2 text-2xl font-semibold text-white">
                                        {money(revenue)}
                                      </div>
                                    </div>

                                    <div>
                                      <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                                        Break-even Tickets
                                      </div>
                                      <div className="mt-2 text-2xl font-semibold text-white">
                                        {breakEvenTickets.toFixed(0)}
                                      </div>
                                    </div>

                                    <div>
                                      <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                                        P/L So Far
                                      </div>
                                      <div
                                        className={`mt-2 text-2xl font-semibold ${
                                          profitLoss >= 0
                                            ? "text-emerald-400"
                                            : "text-rose-400"
                                        }`}
                                      >
                                        {signedMoney(profitLoss)}
                                      </div>
                                    </div>
                                  </div>

                                  {show.notes ? (
                                    <p className="mt-4 text-sm text-zinc-400">
                                      Notes: {show.notes}
                                    </p>
                                  ) : null}
                                </div>

                                <WeeklySalesProgressCard show={show} />
                              </div>

                              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                                <h3 className="text-lg font-semibold text-white">
                                  Editable Costs
                                </h3>

                                <div className="mt-4 grid gap-4">
                                  <label className="grid gap-2">
                                    <span className="text-sm text-zinc-400">Venue Hire</span>
                                    <input
                                      type="number"
                                      value={show.costs.venueHire}
                                      onChange={(e) =>
                                        updateShow(show.id, (current) => ({
                                          ...current,
                                          costs: {
                                            ...current.costs,
                                            venueHire: Number(e.target.value) || 0,
                                          },
                                        }))
                                      }
                                      onBlur={(e) =>
                                        persistField(
                                          show.id,
                                          "venueHire",
                                          Number(e.target.value) || 0
                                        )
                                      }
                                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-zinc-500"
                                    />
                                    {renderSaveStatus(show.id, "venueHire")}
                                  </label>

                                  <label className="grid gap-2">
                                    <span className="text-sm text-zinc-400">Production</span>
                                    <input
                                      type="number"
                                      value={show.costs.production}
                                      onChange={(e) =>
                                        updateShow(show.id, (current) => ({
                                          ...current,
                                          costs: {
                                            ...current.costs,
                                            production: Number(e.target.value) || 0,
                                          },
                                        }))
                                      }
                                      onBlur={(e) =>
                                        persistField(
                                          show.id,
                                          "production",
                                          Number(e.target.value) || 0
                                        )
                                      }
                                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-zinc-500"
                                    />
                                    {renderSaveStatus(show.id, "production")}
                                  </label>

                                  <label className="grid gap-2">
                                    <span className="text-sm text-zinc-400">
                                      Hotel + Petrol + Misc
                                    </span>
                                    <input
                                      type="number"
                                      value={show.costs.hotelPetrolMisc}
                                      onChange={(e) =>
                                        updateShow(show.id, (current) => ({
                                          ...current,
                                          costs: {
                                            ...current.costs,
                                            hotelPetrolMisc: Number(e.target.value) || 0,
                                          },
                                        }))
                                      }
                                      onBlur={(e) =>
                                        persistField(
                                          show.id,
                                          "hotelPetrolMisc",
                                          Number(e.target.value) || 0
                                        )
                                      }
                                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-zinc-500"
                                    />
                                    {renderSaveStatus(show.id, "hotelPetrolMisc")}
                                  </label>

                                  <label className="grid gap-2">
                                    <span className="text-sm text-zinc-400">Ad Spend</span>
                                    <input
                                      type="number"
                                      value={show.metaSpend}
                                      onChange={(e) =>
                                        updateShow(show.id, (current) => ({
                                          ...current,
                                          metaSpend: Number(e.target.value) || 0,
                                        }))
                                      }
                                      onBlur={(e) =>
                                        persistField(
                                          show.id,
                                          "metaSpend",
                                          Number(e.target.value) || 0
                                        )
                                      }
                                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-zinc-500"
                                    />
                                    {renderSaveStatus(show.id, "metaSpend")}
                                  </label>

                                  <label className="grid gap-2">
                                    <span className="text-sm text-zinc-400">Tickets Sold</span>
                                    <input
                                      type="number"
                                      value={show.ticketSales}
                                      onChange={(e) =>
                                        updateShow(show.id, (current) => ({
                                          ...current,
                                          ticketSales: Number(e.target.value) || 0,
                                        }))
                                      }
                                      onBlur={(e) =>
                                        persistField(
                                          show.id,
                                          "ticketSales",
                                          Number(e.target.value) || 0
                                        )
                                      }
                                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-zinc-500"
                                    />
                                    {renderSaveStatus(show.id, "ticketSales")}
                                  </label>

                                  <label className="grid gap-2">
                                    <span className="text-sm text-zinc-400">Capacity</span>
                                    <input
                                      type="number"
                                      value={show.capacity}
                                      onChange={(e) =>
                                        updateShow(show.id, (current) => ({
                                          ...current,
                                          capacity: Number(e.target.value) || 0,
                                        }))
                                      }
                                      onBlur={(e) =>
                                        persistField(
                                          show.id,
                                          "capacity",
                                          Number(e.target.value) || 0
                                        )
                                      }
                                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-zinc-500"
                                    />
                                    {renderSaveStatus(show.id, "capacity")}
                                  </label>

                                  <label className="grid gap-2">
                                    <span className="text-sm text-zinc-400">Ticket Price</span>
                                    <input
                                      type="number"
                                      value={show.ticketPrice}
                                      onChange={(e) =>
                                        updateShow(show.id, (current) => ({
                                          ...current,
                                          ticketPrice: Number(e.target.value) || 0,
                                        }))
                                      }
                                      onBlur={(e) =>
                                        persistField(
                                          show.id,
                                          "ticketPrice",
                                          Number(e.target.value) || 0
                                        )
                                      }
                                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-zinc-500"
                                    />
                                    {renderSaveStatus(show.id, "ticketPrice")}
                                  </label>

                                  <div className="mt-3 space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-zinc-400">Total Show Cost</span>
                                      <span className="text-sm font-medium text-white">
                                        {money(totalCost)}
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-zinc-400">Break-even Tickets</span>
                                      <span className="text-sm font-medium text-white">
                                        {breakEvenTickets.toFixed(1)}
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-zinc-400">% Sold</span>
                                      <span className="text-sm font-medium text-white">
                                        {percent(percentSold)}
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-zinc-400">Tickets 15 Jun+</span>
                                      <span className="text-sm font-medium text-white">
                                        {campaignTickets}
                                      </span>
                                    </div>

                                    <div className="flex items-center justify-between">
                                      <span className="text-sm text-zinc-400">CPT 15 Jun+</span>
                                      <span className="text-sm font-medium text-white">
                                        {campaignTickets === 0 ? "—" : money(costPerTicket)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">Tour Economics</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Editable planning assumptions for forecasting revenue and profit across the tour.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setTourEconomicsOpen((current) => !current)}
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900"
            >
              {tourEconomicsOpen ? "Hide" : "Show"}
            </button>
          </div>

          {tourEconomicsOpen ? (
            <div className="mt-5">
              <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="grid gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
                  <span className="text-sm text-zinc-400">Planned Ad Budget</span>
                  <input
                    type="number"
                    value={plannedAdBudget}
                    onChange={(e) => setPlannedAdBudget(Number(e.target.value) || 0)}
                    onBlur={(e) =>
                      persistSetting(
                        "plannedAdBudget",
                        Number(e.target.value) || 0
                      )
                    }
                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-zinc-500"
                  />
                  {renderSettingSaveStatus("plannedAdBudget")}
                </label>

                <label className="grid gap-2 rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
                  <span className="text-sm text-zinc-400">Blended CPT</span>
                  <input
                    type="number"
                    value={blendedCpt}
                    onChange={(e) => setBlendedCpt(Number(e.target.value) || 0)}
                    onBlur={(e) =>
                      persistSetting(
                        "blendedCpt",
                        Number(e.target.value) || 0
                      )
                    }
                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-zinc-500"
                  />
                  {renderSettingSaveStatus("blendedCpt")}
                </label>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
                  <div className="text-sm text-zinc-400">Weighted Avg Ticket Price</div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {money(kpis.weightedAverageTicketPrice)}
                  </div>
                </div>

                <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
                  <div className="text-sm text-zinc-400">Base Tour Costs</div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {money(kpis.totalTourBaseCosts)}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard title="Total Tour Costs" value={money(kpis.totalTourCosts)} />
                <KpiCard
                  title="Forecast Tickets Sold"
                  value={kpis.forecastTicketsSold.toFixed(0)}
                />
                <KpiCard
                  title="Expected Revenue"
                  value={money(kpis.expectedRevenue)}
                />
                <KpiCard
                  title="Forecast Profit"
                  value={signedMoney(kpis.forecastProfit)}
                  valueClassName={
                    kpis.forecastProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                  }
                />
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}