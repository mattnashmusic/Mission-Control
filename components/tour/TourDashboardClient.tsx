"use client";

import React, { useMemo, useState } from "react";

type TourShow = {
  id: string;
  date: string;
  city: string;
  country: string;
  venue: string;
  capacity: number;
  ticketPrice: number;
  ticketSales: number;
  metaSpend: number;
  notes?: string;
  costs: {
    venueHire: number;
    production: number;
    hotelPetrolMisc: number;
    adSpendPlanned: number;
  };
};

const INITIAL_SHOWS: TourShow[] = [
  {
    id: "hamburg",
    date: "2026-11-20",
    city: "Hamburg",
    country: "DE",
    venue: "Monkeys Music Club",
    capacity: 350,
    ticketPrice: 22,
    ticketSales: 0,
    metaSpend: 0,
    notes: "Fri or Sat",
    costs: {
      venueHire: 1600,
      production: 500,
      hotelPetrolMisc: 250,
      adSpendPlanned: 1500,
    },
  },
  {
    id: "berlin",
    date: "2026-11-22",
    city: "Berlin",
    country: "DE",
    venue: "Badehaus",
    capacity: 200,
    ticketPrice: 22,
    ticketSales: 0,
    metaSpend: 0,
    notes: "Sun",
    costs: {
      venueHire: 725,
      production: 500,
      hotelPetrolMisc: 250,
      adSpendPlanned: 1500,
    },
  },
  {
    id: "munich",
    date: "2026-11-23",
    city: "Munich",
    country: "DE",
    venue: "Fierwerk / Orangehaus",
    capacity: 200,
    ticketPrice: 22,
    ticketSales: 0,
    metaSpend: 0,
    notes: "Mon",
    costs: {
      venueHire: 875,
      production: 500,
      hotelPetrolMisc: 250,
      adSpendPlanned: 1500,
    },
  },
  {
    id: "zurich",
    date: "2026-11-24",
    city: "Zurich",
    country: "CH",
    venue: "Xtra Cafe",
    capacity: 140,
    ticketPrice: 25,
    ticketSales: 0,
    metaSpend: 0,
    notes: "Tues",
    costs: {
      venueHire: 240,
      production: 500,
      hotelPetrolMisc: 250,
      adSpendPlanned: 1500,
    },
  },
  {
    id: "cologne",
    date: "2026-11-26",
    city: "Cologne",
    country: "DE",
    venue: "Yuca",
    capacity: 270,
    ticketPrice: 22,
    ticketSales: 0,
    metaSpend: 0,
    notes: "Thurs",
    costs: {
      venueHire: 1204,
      production: 500,
      hotelPetrolMisc: 250,
      adSpendPlanned: 1500,
    },
  },
  {
    id: "brussels",
    date: "2026-11-27",
    city: "Brussels",
    country: "BE",
    venue: "Pilar",
    capacity: 300,
    ticketPrice: 22,
    ticketSales: 0,
    metaSpend: 0,
    notes: "Fri or Sat both Reserved",
    costs: {
      venueHire: 1385,
      production: 500,
      hotelPetrolMisc: 250,
      adSpendPlanned: 1500,
    },
  },
  {
    id: "nijmegen",
    date: "2026-12-01",
    city: "Nijmegen",
    country: "NL",
    venue: "Merleyn",
    capacity: 180,
    ticketPrice: 20,
    ticketSales: 0,
    metaSpend: 0,
    notes: "Tuesday",
    costs: {
      venueHire: 0,
      production: 0,
      hotelPetrolMisc: 150,
      adSpendPlanned: 1500,
    },
  },
  {
    id: "amsterdam",
    date: "2026-12-04",
    city: "Amsterdam",
    country: "NL",
    venue: "Toekomst",
    capacity: 350,
    ticketPrice: 22,
    ticketSales: 0,
    metaSpend: 0,
    notes: "Thurs",
    costs: {
      venueHire: 500,
      production: 500,
      hotelPetrolMisc: 0,
      adSpendPlanned: 1500,
    },
  },
];

const TOUR_AD_BUDGET = 12000;

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
  return show.ticketSales * show.ticketPrice;
}

function calculateProfitLoss(show: TourShow) {
  return calculateRevenue(show) - calculateShowTotalCost(show);
}

function calculatePercentSold(show: TourShow) {
  if (show.capacity === 0) return 0;
  return (show.ticketSales / show.capacity) * 100;
}

function calculateCostPerTicket(show: TourShow) {
  if (show.ticketSales === 0) return 0;
  return show.metaSpend / show.ticketSales;
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

export default function TourDashboardClient() {
  const [shows, setShows] = useState<TourShow[]>(INITIAL_SHOWS);
  const [expandedShowId, setExpandedShowId] = useState<string | null>(null);

  const kpis = useMemo(() => {
    const upcomingShows = shows.length;
    const ticketsSoldTotal = shows.reduce((sum, show) => sum + show.ticketSales, 0);
    const totalCapacity = shows.reduce((sum, show) => sum + show.capacity, 0);
    const adSpendTotal = shows.reduce((sum, show) => sum + show.metaSpend, 0);
    const percentTourSold =
      totalCapacity === 0 ? 0 : (ticketsSoldTotal / totalCapacity) * 100;
    const costPerTicket =
      ticketsSoldTotal === 0 ? 0 : adSpendTotal / ticketsSoldTotal;

    const totalTourCosts = shows.reduce(
      (sum, show) => sum + calculateShowBaseCostExcludingAds(show),
      0
    );

    const totalExpectedRevenue = shows.reduce(
      (sum, show) => sum + show.capacity * show.ticketPrice,
      0
    );

    const forecastProfit = totalExpectedRevenue - totalTourCosts;

    const breakEvenPercentOfTour =
      totalExpectedRevenue === 0 ? 0 : (totalTourCosts / totalExpectedRevenue) * 100;

    const breakEvenTickets =
      totalCapacity === 0 ? 0 : (breakEvenPercentOfTour / 100) * totalCapacity;

    const ticketsCoveredByAdBudget =
      costPerTicket === 0 ? 0 : TOUR_AD_BUDGET / costPerTicket;

    return {
      upcomingShows,
      ticketsSoldTotal,
      adSpendTotal,
      percentTourSold,
      costPerTicket,
      totalTourCosts,
      totalExpectedRevenue,
      forecastProfit,
      breakEvenPercentOfTour,
      breakEvenTickets,
      ticketsCoveredByAdBudget,
    };
  }, [shows]);

  function updateShow(
    showId: string,
    updater: (current: TourShow) => TourShow
  ) {
    setShows((current) =>
      current.map((show) => (show.id === showId ? updater(show) : show))
    );
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

        <section className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KpiCard title="🎫 Upcoming Shows" value={String(kpis.upcomingShows)} />
          <KpiCard title="📈 Tickets Sold Total" value={String(kpis.ticketsSoldTotal)} />
          <KpiCard title="📣 Ad Spend So Far" value={money(kpis.adSpendTotal)} />
          <KpiCard title="% of Tour Sold" value={percent(kpis.percentTourSold)} />
          <KpiCard
            title="💸 Cost Per Ticket"
            value={kpis.ticketsSoldTotal === 0 ? "—" : money(kpis.costPerTicket)}
          />
        </section>

        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5">
          <div className="mb-4">
            <h2 className="text-2xl font-semibold text-white">Tour Economics</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Tour-level forecast based on total capacity, ticket prices, and show costs.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <KpiCard title="Total Tour Costs" value={money(kpis.totalTourCosts)} />
            <KpiCard
              title="Total Expected Revenue"
              value={money(kpis.totalExpectedRevenue)}
            />
            <KpiCard
              title="Forecast Profit"
              value={signedMoney(kpis.forecastProfit)}
              valueClassName={
                kpis.forecastProfit >= 0 ? "text-emerald-400" : "text-rose-400"
              }
            />
            <KpiCard
              title="Break-even Tickets"
              value={kpis.breakEvenTickets.toFixed(0)}
            />
            <KpiCard
              title="Break-even % of Tour"
              value={percent(kpis.breakEvenPercentOfTour)}
            />
            <KpiCard
              title="Tickets Covered by €12k"
              value={
                kpis.costPerTicket === 0
                  ? "—"
                  : kpis.ticketsCoveredByAdBudget.toFixed(0)
              }
            />
          </div>
        </section>

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
                  <th className="px-4 py-3 text-right font-medium">Capacity</th>
                  <th className="px-4 py-3 text-right font-medium">% Sold</th>
                  <th className="px-4 py-3 text-right font-medium">Ad Spend</th>
                  <th className="px-4 py-3 text-right font-medium">Cost / Ticket</th>
                </tr>
              </thead>

              <tbody>
                {shows.map((show) => {
                  const isExpanded = expandedShowId === show.id;
                  const percentSold = calculatePercentSold(show);
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
                        <td className="px-4 py-4 text-right text-zinc-400">
                          {show.capacity}
                        </td>
                        <td className="px-4 py-4 text-right">{percent(percentSold)}</td>
                        <td className="px-4 py-4 text-right">{money(show.metaSpend)}</td>
                        <td className="px-4 py-4 text-right">
                          {show.ticketSales === 0 ? "—" : money(costPerTicket)}
                        </td>
                      </tr>

                      {isExpanded ? (
                        <tr className="border-t border-zinc-800 bg-zinc-950/50">
                          <td colSpan={8} className="px-5 py-5">
                            <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
                              <div className="space-y-5">
                                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                                  <h3 className="text-lg font-semibold text-white">
                                    Show Snapshot
                                  </h3>

                                  <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

                                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
                                  <h3 className="text-lg font-semibold text-white">
                                    Ticket Sales Over Time
                                  </h3>
                                  <div className="mt-4 flex h-64 items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-zinc-950/50 text-sm text-zinc-500">
                                    Placeholder for ticket sales graph
                                  </div>
                                </div>
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
                                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-zinc-500"
                                    />
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
                                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-zinc-500"
                                    />
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
                                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-zinc-500"
                                    />
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
                                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-zinc-500"
                                    />
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
                                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-zinc-500"
                                    />
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
                                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-zinc-500"
                                    />
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
                                      className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white outline-none focus:border-zinc-500"
                                    />
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
      </div>
    </main>
  );
}