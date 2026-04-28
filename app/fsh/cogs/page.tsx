import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createCostEntry } from "./actions";

const COST_ITEMS = [
  { itemKey: "cd1", itemName: "CD1", category: "Product" },
  { itemKey: "cd2", itemName: "CD2", category: "Product" },
  { itemKey: "vinyl", itemName: "Vinyl", category: "Product" },
  { itemKey: "cd_envelope", itemName: "CD Envelope", category: "Packaging" },
  { itemKey: "vinyl_box", itemName: "Vinyl Box", category: "Packaging" },
  { itemKey: "printer_label", itemName: "Printer Label", category: "Fulfillment" },
];

function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function date(value: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

export default async function CogsPage() {
  const entries = await prisma.cogsCostEntry.findMany({
    orderBy: [{ itemKey: "asc" }, { effectiveFrom: "desc" }],
  });

  const latestByItem = COST_ITEMS.map((item) => {
    const latest = entries.find((entry) => entry.itemKey === item.itemKey);

    return {
      ...item,
      latest,
    };
  });

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-zinc-400">FSH Dashboard</p>
            <h1 className="text-3xl font-bold tracking-tight">COGS</h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Cost history for products, packaging, and fulfillment items. Adding a new cost does not overwrite history.
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
          {latestByItem.map((item) => (
            <div
              key={item.itemKey}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow"
            >
              <p className="text-sm text-zinc-500">{item.category}</p>
              <h2 className="mt-1 text-lg font-semibold">{item.itemName}</h2>

              {item.latest ? (
                <>
                  <p className="mt-4 text-3xl font-bold">
                    {money(item.latest.unitCost)}
                  </p>
                  <p className="mt-2 text-sm text-zinc-400">
                    Effective from {date(item.latest.effectiveFrom)}
                  </p>
                </>
              ) : (
                <>
                  <p className="mt-4 text-3xl font-bold text-zinc-600">Not set</p>
                  <p className="mt-2 text-sm text-zinc-500">
                    Add the first cost entry below.
                  </p>
                </>
              )}
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-semibold">Add New Cost Entry</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Use this when a new batch/order has a different cost. Old orders can still use the old cost later.
          </p>

          <form action={createCostEntry} className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm text-zinc-400">Item</span>
              <select
                name="itemKey"
                required
                className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-white"
              >
                {COST_ITEMS.map((item) => (
                  <option key={item.itemKey} value={item.itemKey}>
                    {item.itemName}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm text-zinc-400">Item Name</span>
              <select
                name="itemName"
                required
                className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-white"
              >
                {COST_ITEMS.map((item) => (
                  <option key={item.itemKey} value={item.itemName}>
                    {item.itemName}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm text-zinc-400">Category</span>
              <select
                name="category"
                required
                className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-white"
              >
                <option value="Product">Product</option>
                <option value="Packaging">Packaging</option>
                <option value="Fulfillment">Fulfillment</option>
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm text-zinc-400">Unit Cost</span>
              <input
                name="unitCost"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0.52"
                className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-white"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-zinc-400">Effective From</span>
              <input
                name="effectiveFrom"
                type="date"
                required
                className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-white"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-zinc-400">Notes</span>
              <input
                name="notes"
                type="text"
                placeholder="First 200 CD1 batch"
                className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-white"
              />
            </label>

            <div className="md:col-span-2 lg:col-span-3">
              <button
                type="submit"
                className="rounded-xl bg-white px-5 py-2 font-semibold text-black hover:bg-zinc-200"
              >
                Add Cost Entry
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-semibold">Cost History</h2>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="py-3 pr-4">Item</th>
                  <th className="py-3 pr-4">Category</th>
                  <th className="py-3 pr-4">Unit Cost</th>
                  <th className="py-3 pr-4">Effective From</th>
                  <th className="py-3 pr-4">Notes</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-zinc-500">
                      No COGS entries yet.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-zinc-900">
                      <td className="py-3 pr-4 font-medium text-white">
                        {entry.itemName}
                      </td>
                      <td className="py-3 pr-4 text-zinc-400">
                        {entry.category}
                      </td>
                      <td className="py-3 pr-4 text-zinc-300">
                        {money(entry.unitCost)}
                      </td>
                      <td className="py-3 pr-4 text-zinc-400">
                        {date(entry.effectiveFrom)}
                      </td>
                      <td className="py-3 pr-4 text-zinc-500">
                        {entry.notes || "—"}
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