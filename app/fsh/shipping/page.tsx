import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createShippingCostEntry, deleteShippingCostEntry } from "./actions";

export const dynamic = "force-dynamic";

const COUNTRIES = [
  { countryCode: "NL", countryName: "Netherlands" },
  { countryCode: "DE", countryName: "Germany" },
  { countryCode: "BE", countryName: "Belgium" },
  { countryCode: "CH", countryName: "Switzerland" },
  { countryCode: "FR", countryName: "France" },
  { countryCode: "LU", countryName: "Luxembourg" },
  { countryCode: "DK", countryName: "Denmark" },
  { countryCode: "GB", countryName: "UK" },
  { countryCode: "FI", countryName: "Finland" },
  { countryCode: "IE", countryName: "Ireland" },
  { countryCode: "IT", countryName: "Italy" },
  { countryCode: "NO", countryName: "Norway" },
  { countryCode: "AT", countryName: "Austria" },
  { countryCode: "PL", countryName: "Poland" },
  { countryCode: "PT", countryName: "Portugal" },
  { countryCode: "ES", countryName: "Spain" },
  { countryCode: "SE", countryName: "Sweden" },
  { countryCode: "DEFAULT", countryName: "Default" },
];

function money(value: number | null | undefined) {
  if (value === null || value === undefined) return "Same as CD package";

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

export default async function ShippingPage() {
  const entries = await prisma.shippingCostEntry.findMany({
    orderBy: [
      { countryCode: "asc" },
      { effectiveFrom: "desc" },
      { createdAt: "desc" },
    ],
  });

  const latestByCountry = COUNTRIES.map((country) => {
    const latest = entries.find(
      (entry) => entry.countryCode === country.countryCode
    );

    return {
      ...country,
      latest,
    };
  });

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-zinc-400">FSH Dashboard</p>
            <h1 className="text-3xl font-bold tracking-tight">Shipping Costs</h1>
            <p className="mt-2 max-w-3xl text-sm text-zinc-400">
              Historical shipping costs by country. Vinyl can either ship separately from CDs or include CDs inside the vinyl box from a chosen effective date.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/fsh/cogs"
              className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-600 hover:text-white"
            >
              COGS
            </Link>

            <Link
              href="/fsh"
              className="rounded-xl border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-600 hover:text-white"
            >
              Back to FSH
            </Link>
          </div>
        </div>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-semibold">Shipping Logic</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-black p-4">
              <h3 className="font-semibold text-white">Before vinyl arrives</h3>
              <p className="mt-2 text-sm text-zinc-400">
                CD ships separately. Vinyl ships separately later.
              </p>
              <p className="mt-3 text-sm text-zinc-300">
                Shipping = CD shipment + vinyl shipment
              </p>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-black p-4">
              <h3 className="font-semibold text-white">After vinyl arrives</h3>
              <p className="mt-2 text-sm text-zinc-400">
                CDs can go inside the vinyl box.
              </p>
              <p className="mt-3 text-sm text-zinc-300">
                Shipping = vinyl shipment only
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {latestByCountry.map((country) => (
            <div
              key={country.countryCode}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-zinc-500">{country.countryCode}</p>
                  <h2 className="mt-1 text-lg font-semibold">
                    {country.countryName}
                  </h2>
                </div>

                {country.latest?.vinylIncludesCds ? (
                  <span className="rounded-full border border-green-900/60 px-3 py-1 text-xs text-green-400">
                    Vinyl includes CDs
                  </span>
                ) : country.latest ? (
                  <span className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400">
                    Separate shipping
                  </span>
                ) : null}
              </div>

              {country.latest ? (
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-zinc-400">CD1 only</span>
                    <span className="font-medium text-white">
                      {money(country.latest.cd1OnlyCost)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-zinc-400">CD package</span>
                    <span className="font-medium text-white">
                      {money(country.latest.cdPackageCost)}
                    </span>
                  </div>

                  <div className="flex justify-between gap-4">
                    <span className="text-zinc-400">Vinyl tracked</span>
                    <span className="font-medium text-white">
                      {money(country.latest.vinylCost)}
                    </span>
                  </div>

                  <p className="pt-2 text-xs text-zinc-500">
                    Effective from {date(country.latest.effectiveFrom)}
                  </p>
                </div>
              ) : (
                <>
                  <p className="mt-4 text-3xl font-bold text-zinc-600">Not set</p>
                  <p className="mt-2 text-sm text-zinc-500">
                    Add the first shipping entry below.
                  </p>
                </>
              )}
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-semibold">Add New Shipping Entry</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Add a new row when your shipping cost changes, or when vinyl starts shipping with CDs inside the vinyl box.
          </p>

          <form
            action={createShippingCostEntry}
            className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3"
          >
            <label className="space-y-2">
              <span className="text-sm text-zinc-400">Country</span>
              <select
                name="countryCode"
                required
                className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-white"
              >
                {COUNTRIES.map((country) => (
                  <option key={country.countryCode} value={country.countryCode}>
                    {country.countryName}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm text-zinc-400">Country Name</span>
              <select
                name="countryName"
                required
                className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-white"
              >
                {COUNTRIES.map((country) => (
                  <option key={country.countryCode} value={country.countryName}>
                    {country.countryName}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm text-zinc-400">CD1 Only Cost</span>
              <input
                name="cd1OnlyCost"
                type="number"
                step="0.01"
                min="0"
                placeholder="Only needed for NL, e.g. 2.80"
                className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-white"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-zinc-400">CD Package Cost</span>
              <input
                name="cdPackageCost"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="4.40"
                className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-white"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-zinc-400">Vinyl Tracked Cost</span>
              <input
                name="vinylCost"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="7.40"
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

            <label className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-black px-3 py-2">
              <input
                name="vinylIncludesCds"
                type="checkbox"
                className="h-4 w-4"
              />
              <span className="text-sm text-zinc-300">
                Vinyl shipment includes CDs
              </span>
            </label>

            <label className="space-y-2 md:col-span-2">
              <span className="text-sm text-zinc-400">Notes</span>
              <input
                name="notes"
                type="text"
                placeholder="Baseline shipping table"
                className="w-full rounded-xl border border-zinc-800 bg-black px-3 py-2 text-white"
              />
            </label>

            <div className="md:col-span-2 lg:col-span-3">
              <button
                type="submit"
                className="rounded-xl bg-white px-5 py-2 font-semibold text-black hover:bg-zinc-200"
              >
                Add Shipping Entry
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
          <h2 className="text-xl font-semibold">Shipping History</h2>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-zinc-800 text-zinc-400">
                <tr>
                  <th className="py-3 pr-4">Country</th>
                  <th className="py-3 pr-4">CD1 Only</th>
                  <th className="py-3 pr-4">CD Package</th>
                  <th className="py-3 pr-4">Vinyl</th>
                  <th className="py-3 pr-4">Vinyl Includes CDs</th>
                  <th className="py-3 pr-4">Effective From</th>
                  <th className="py-3 pr-4">Notes</th>
                  <th className="py-3 pr-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-zinc-500">
                      No shipping entries yet.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-zinc-900">
                      <td className="py-3 pr-4 font-medium text-white">
                        {entry.countryName}{" "}
                        <span className="text-zinc-500">
                          ({entry.countryCode})
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-zinc-300">
                        {money(entry.cd1OnlyCost)}
                      </td>
                      <td className="py-3 pr-4 text-zinc-300">
                        {money(entry.cdPackageCost)}
                      </td>
                      <td className="py-3 pr-4 text-zinc-300">
                        {money(entry.vinylCost)}
                      </td>
                      <td className="py-3 pr-4 text-zinc-400">
                        {entry.vinylIncludesCds ? "Yes" : "No"}
                      </td>
                      <td className="py-3 pr-4 text-zinc-400">
                        {date(entry.effectiveFrom)}
                      </td>
                      <td className="py-3 pr-4 text-zinc-500">
                        {entry.notes || "—"}
                      </td>
                      <td className="py-3 pr-4 text-right">
                        <form action={deleteShippingCostEntry}>
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