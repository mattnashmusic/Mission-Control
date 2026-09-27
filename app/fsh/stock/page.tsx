import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getStockSummaries } from "@/lib/stock";
import { PRODUCT_ITEMS } from "@/lib/products";
import {
  createStockCount,
  deleteStockCount,
  upsertReorderSetting,
} from "./actions";

export const dynamic = "force-dynamic";

function integer(value: number) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(
    value,
  );
}

function pace(value: number) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(
    value,
  );
}

function date(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function statusMeta(status: string) {
  switch (status) {
    case "reorder-now":
      return {
        label: "Reorder now",
        textClass: "text-rose-400",
        badgeClass: "border-rose-900/60 bg-rose-950/40 text-rose-300",
      };
    case "reorder-soon":
      return {
        label: "Reorder soon",
        textClass: "text-amber-400",
        badgeClass: "border-amber-900/60 bg-amber-950/40 text-amber-300",
      };
    case "ok":
      return {
        label: "Stocked",
        textClass: "text-emerald-400",
        badgeClass: "border-emerald-900/60 bg-emerald-950/40 text-emerald-300",
      };
    default:
      return {
        label: "No count logged",
        textClass: "text-zinc-500",
        badgeClass: "border-zinc-800 bg-zinc-900 text-zinc-400",
      };
  }
}

export default async function StockPage() {
  const [summaries, countEntries] = await Promise.all([
    getStockSummaries(),
    prisma.stockCountEntry.findMany({
      orderBy: [{ itemKey: "asc" }, { countedAt: "desc" }],
    }),
  ]);

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-zinc-400">FSH Dashboard</p>
            <h1 className="text-3xl font-bold tracking-tight">
              Stock &amp; Reorder
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Log a physical count whenever you do one. Units sold since that
              count (combined across the funnel and store listings), sales
              pace, and when to reorder are all calculated automatically.
            </p>
          </div>

          <Link
            href="/fsh"
            className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-600 hover:text-white"
          >
            Back to FSH
          </Link>
        </div>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {summaries.map((summary) => {
            const meta = statusMeta(summary.status);

            return (
              <div
                key={summary.itemKey}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    {summary.itemName}
                  </h2>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${meta.badgeClass}`}
                  >
                    {meta.label}
                  </span>
                </div>

                {summary.currentStock === null ? (
                  <p className="mt-4 text-sm text-zinc-500">
                    Log a stock count below to start tracking.
                  </p>
                ) : (
                  <>
                    <p className="mt-4 text-3xl font-bold">
                      {integer(Math.max(0, summary.currentStock))}
                    </p>
                    <p className="text-xs text-zinc-500">
                      units on hand (estimated)
                    </p>

                    <div className="mt-4 space-y-1.5 border-t border-zinc-800 pt-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Pace (30d avg)</span>
                        <span className="text-zinc-200">
                          {pace(summary.dailyPace30)}/day
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">
                          Days of stock left
                        </span>
                        <span className="text-zinc-200">
                          {summary.daysOfStockLeft === null
                            ? "—"
                            : `${integer(summary.daysOfStockLeft)} days`}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">
                          Lead time (+ buffer)
                        </span>
                        <span className="text-zinc-200">
                          {summary.leadTimeDays} days
                        </span>
                      </div>
                      {summary.runOutDate ? (
                        <div className="flex justify-between">
                          <span className="text-zinc-400">
                            Projected run-out
                          </span>
                          <span className="text-zinc-200">
                            {date(summary.runOutDate)}
                          </span>
                        </div>
                      ) : null}
                      {summary.orderByDate ? (
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Order by</span>
                          <span className={meta.textClass}>
                            {date(summary.orderByDate)}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {summary.latestCount ? (
                      <p className="mt-3 text-xs text-zinc-500">
                        Last count: {integer(summary.latestCount.quantity)} on{" "}
                        {date(summary.latestCount.countedAt)}
                        {summary.unitsSoldSinceCount > 0
                          ? ` · ${integer(summary.unitsSoldSinceCount)} sold since`
                          : ""}
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            );
          })}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-semibold">Log a Stock Count</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Enter the total physical units on hand for that product, regardless
            of which Shopify listing they&apos;ll eventually sell through.
          </p>

          <form
            action={createStockCount}
            className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4"
          >
            <label className="space-y-2">
              <span className="text-sm text-zinc-400">Item</span>
              <select
                name="itemKey"
                required
                className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-white"
              >
                {PRODUCT_ITEMS.map((item) => (
                  <option key={item.itemKey} value={item.itemKey}>
                    {item.itemName}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm text-zinc-400">Quantity</span>
              <input
                name="quantity"
                type="number"
                step="1"
                min="0"
                required
                placeholder="193"
                className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-white"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-zinc-400">Counted On</span>
              <input
                name="countedAt"
                type="date"
                required
                defaultValue={todayInputValue()}
                className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-white"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-zinc-400">Notes</span>
              <input
                name="notes"
                type="text"
                placeholder="Full count after Hamburg show"
                className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-white"
              />
            </label>

            <div className="md:col-span-2 lg:col-span-4">
              <button
                type="submit"
                className="rounded-xl bg-white px-5 py-2 font-semibold text-black hover:bg-zinc-200"
              >
                Log Count
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-semibold">Reorder Lead Times</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Production + shipping is how long a fresh order takes to arrive.
            Buffer adds cushion for delays or a sales spike — the alert fires
            once days of stock left drops to lead time + buffer.
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {summaries.map((summary) => (
              <form
                key={summary.itemKey}
                action={upsertReorderSetting}
                className="space-y-3 rounded-xl border border-zinc-800 p-4"
              >
                <input type="hidden" name="itemKey" value={summary.itemKey} />
                <p className="text-sm font-medium text-zinc-200">
                  {summary.itemName}
                </p>

                <label className="block space-y-1">
                  <span className="text-xs text-zinc-500">
                    Production (days)
                  </span>
                  <input
                    name="productionDays"
                    type="number"
                    min="0"
                    required
                    defaultValue={summary.productionDays}
                    className="w-full rounded-lg border border-zinc-800 bg-black px-2 py-1.5 text-sm text-white"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-zinc-500">
                    Shipping (days)
                  </span>
                  <input
                    name="shippingDays"
                    type="number"
                    min="0"
                    required
                    defaultValue={summary.shippingDays}
                    className="w-full rounded-lg border border-zinc-800 bg-black px-2 py-1.5 text-sm text-white"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs text-zinc-500">Buffer (days)</span>
                  <input
                    name="bufferDays"
                    type="number"
                    min="0"
                    required
                    defaultValue={summary.bufferDays}
                    className="w-full rounded-lg border border-zinc-800 bg-black px-2 py-1.5 text-sm text-white"
                  />
                </label>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-black hover:bg-zinc-200"
                >
                  Save
                </button>
              </form>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-semibold">Count History</h2>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="py-3 pr-4">Item</th>
                  <th className="py-3 pr-4">Quantity</th>
                  <th className="py-3 pr-4">Counted On</th>
                  <th className="py-3 pr-4">Notes</th>
                  <th className="py-3 pr-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {countEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-zinc-500">
                      No stock counts logged yet.
                    </td>
                  </tr>
                ) : (
                  countEntries.map((entry) => (
                    <tr key={entry.id} className="border-b border-zinc-900">
                      <td className="py-3 pr-4 font-medium text-white">
                        {entry.itemName}
                      </td>
                      <td className="py-3 pr-4 text-zinc-300">
                        {integer(entry.quantity)}
                      </td>
                      <td className="py-3 pr-4 text-zinc-400">
                        {date(entry.countedAt)}
                      </td>
                      <td className="py-3 pr-4 text-zinc-500">
                        {entry.notes || "—"}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <form action={deleteStockCount}>
                          <input type="hidden" name="id" value={entry.id} />
                          <button
                            type="submit"
                            className="rounded-lg border border-red-900/60 px-3 py-1 text-xs text-red-400 hover:border-red-500 hover:text-red-300"
                          >
                            Delete
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
