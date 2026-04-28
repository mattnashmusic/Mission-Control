import Link from "next/link";
import SyncButton from "@/components/SyncButton";
import { prisma } from "@/lib/prisma";
import { getTourMetaSnapshot } from "@/lib/meta-tour";
const TOUR_VOTE_CAMPAIGN_ID = "120238758856380724";

const TIME_ZONE = "Europe/Amsterdam";

type TourVoteRow = {
  id: string;
  name: string;
  email: string;
  selectedCity: string;
  selectedCountry: string;
  inferredCity: string | null;
  inferredCountry: string | null;
  createdAt: Date;
};

function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function getDateKey(dateLike: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dateLike));
}

function formatDateTime(dateLike: string | Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateLike));
}

function buildRecentDateKeySet(days: number) {
  const keys = new Set<string>();
  const now = new Date();

  for (let i = 0; i < days; i += 1) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    keys.add(getDateKey(date));
  }

  return keys;
}

function filterVotesByDateKeys(votes: TourVoteRow[], dateKeys: Set<string>) {
  return votes.filter((vote) => dateKeys.has(getDateKey(vote.createdAt)));
}

function getTopCity(votes: TourVoteRow[]) {
  if (votes.length === 0) {
    return { city: "—", count: 0 };
  }

  const counts = new Map<string, number>();

  for (const vote of votes) {
    counts.set(vote.selectedCity, (counts.get(vote.selectedCity) || 0) + 1);
  }

  const [city, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];

  return { city, count };
}

function getCityLeaderboard(votes: TourVoteRow[]) {
  const counts = new Map<string, number>();

  for (const vote of votes) {
    counts.set(vote.selectedCity, (counts.get(vote.selectedCity) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count);
}

function getCountryLeaderboard(votes: TourVoteRow[]) {
  const counts = new Map<string, number>();

  for (const vote of votes) {
    counts.set(vote.selectedCountry, (counts.get(vote.selectedCountry) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([country, count]) => ({ country, count }))
    .sort((a, b) => b.count - a.count);
}

function KpiCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle?: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
        {title}
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight text-white">
        {value}
      </div>
      {subtitle ? (
        <div className="mt-2 text-sm text-zinc-400">{subtitle}</div>
      ) : null}
    </div>
  );
}

export default async function TourVotePage() {
  let votes: TourVoteRow[] = [];
  let metaSpendToday = 0;
  let metaSpendTotal = 0;

  try {
    votes = await prisma.tourVote.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch {
    votes = [];
  }

  try {
    const meta = await getTourMetaSnapshot(TOUR_VOTE_CAMPAIGN_ID);
    metaSpendToday = typeof meta?.spend?.today === "number" ? meta.spend.today : 0;
    metaSpendTotal = typeof meta?.spend?.lifetime === "number" ? meta.spend.lifetime : 0;
  } catch {
    metaSpendToday = 0;
    metaSpendTotal = 0;
  }

  const todayVotes = filterVotesByDateKeys(votes, buildRecentDateKeySet(1));
  const sevenDayVotes = filterVotesByDateKeys(votes, buildRecentDateKeySet(7));
  const thirtyDayVotes = filterVotesByDateKeys(votes, buildRecentDateKeySet(30));

  const totalVotes = votes.length;
  const todayCount = todayVotes.length;
  const sevenDayCount = sevenDayVotes.length;
  const thirtyDayCount = thirtyDayVotes.length;

  const topCity = getTopCity(votes);
  const cityLeaderboard = getCityLeaderboard(votes);
  const countryLeaderboard = getCountryLeaderboard(votes);

  const totalMetaSpend = metaSpendTotal;

  const costPerSignupToday =
    todayCount > 0 ? metaSpendToday / todayCount : 0;

  const costPerSignupTotal =
    totalVotes > 0 ? totalMetaSpend / totalVotes : 0;

  return (
    <main className="min-h-screen bg-[#07090f] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              href="/"
              className="mb-3 inline-flex text-sm text-zinc-400 transition hover:text-white"
            >
              ← Back to Mission Control
            </Link>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Tour Vote
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 sm:text-base">
              Pre-tour data collection from the vote landing page, combined with
              Meta spend so you can track demand and cost per signup.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-300">
              Meta spend today:{" "}
              <span className="font-semibold text-white">
                {money(metaSpendToday)}
              </span>
            </div>
            <SyncButton />
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            title="Total signups"
            value={String(totalVotes)}
            subtitle={`${thirtyDayCount} in the last 30 days`}
          />
          <KpiCard
            title="Signups today"
            value={String(todayCount)}
            subtitle={`${sevenDayCount} in the last 7 days`}
          />
          <KpiCard
            title="Top city"
            value={topCity.city}
            subtitle={
              topCity.count > 0 ? `${topCity.count} total signups` : "No data yet"
            }
          />
          <KpiCard
            title="Meta spend today"
            value={money(metaSpendToday)}
            subtitle="Live Meta snapshot"
          />
          <KpiCard
            title="Meta spend total"
            value={money(totalMetaSpend)}
            subtitle={`Tour campaign lifetime from Meta`}
          />
          <KpiCard
            title="Cost / signup today"
            value={todayCount > 0 ? money(costPerSignupToday) : "—"}
            subtitle={
              todayCount > 0
                ? `${money(metaSpendToday)} / ${todayCount} signups`
                : "Waiting for today's first signup"
            }
          />
          <KpiCard
            title="Cost / signup total"
            value={totalVotes > 0 ? money(costPerSignupTotal) : "—"}
            subtitle={
              totalVotes > 0
                ? `${money(totalMetaSpend)} / ${totalVotes} total signups`
                : "No signups yet"
            }
          />
          <KpiCard
            title="Signups 7d"
            value={String(sevenDayCount)}
            subtitle={`${String(thirtyDayCount)} in the last 30 days`}
          />
        </section>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur">
            <div className="mb-5">
              <h2 className="text-xl font-semibold tracking-tight text-white">
                City leaderboard
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Ranked by total signups captured from the tour vote page.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10">
              <table className="min-w-full divide-y divide-white/10 text-sm">
                <thead className="bg-white/5 text-zinc-400">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">City</th>
                    <th className="px-4 py-3 text-left font-medium">Signups</th>
                    <th className="px-4 py-3 text-left font-medium">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {cityLeaderboard.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-zinc-500">
                        No signups yet.
                      </td>
                    </tr>
                  ) : (
                    cityLeaderboard.map((row) => {
                      const share =
                        totalVotes > 0
                          ? `${((row.count / totalVotes) * 100).toFixed(1)}%`
                          : "0%";

                      return (
                        <tr key={row.city}>
                          <td className="px-4 py-3 text-white">{row.city}</td>
                          <td className="px-4 py-3 text-zinc-300">{row.count}</td>
                          <td className="px-4 py-3 text-zinc-400">{share}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur">
              <h2 className="text-xl font-semibold tracking-tight text-white">
                Country split
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Broad market demand before you zoom into cities.
              </p>

              <div className="mt-4 space-y-3">
                {countryLeaderboard.length === 0 ? (
                  <div className="text-sm text-zinc-500">No signups yet.</div>
                ) : (
                  countryLeaderboard.map((row) => (
                    <div
                      key={row.country}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <div className="text-sm text-white">{row.country}</div>
                      <div className="text-sm font-semibold text-zinc-300">
                        {row.count}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur">
              <h2 className="text-xl font-semibold tracking-tight text-white">
                Recent signups
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Latest submissions from the landing page.
              </p>

              <div className="mt-4 space-y-3">
                {votes.length === 0 ? (
                  <div className="text-sm text-zinc-500">No signups yet.</div>
                ) : (
                  votes.slice(0, 12).map((vote) => (
                    <div
                      key={vote.id}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-medium text-white">
                            {vote.name}
                          </div>
                          <div className="text-sm text-zinc-400">
                            {vote.email}
                          </div>
                        </div>
                        <div className="text-right text-xs text-zinc-500">
                          {formatDateTime(vote.createdAt)}
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-300">
                          Selected: {vote.selectedCity}, {vote.selectedCountry}
                        </span>

                        {vote.inferredCity || vote.inferredCountry ? (
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-zinc-400">
                            Inferred: {vote.inferredCity || "—"},{" "}
                            {vote.inferredCountry || "—"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}