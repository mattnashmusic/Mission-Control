import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getTourMetaSnapshot } from "@/lib/meta-tour";
import { TOUR_CAMPAIGNS } from "@/lib/tour-campaigns";

const TIME_ZONE = "Europe/Amsterdam";

type TourVoteRow = {
  id: string;
  name: string;
  email: string;
  selectedCity: string;
  selectedCountry: string;
  inferredCity: string | null;
  inferredCountry: string | null;
  source: string | null;
  createdAt: Date;
};

function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function number(value: number) {
  return new Intl.NumberFormat("en-GB").format(value);
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

function normalise(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

function isToday(dateLike: string | Date) {
  return getDateKey(dateLike) === getDateKey(new Date());
}

function voteMatchesCampaign(
  vote: TourVoteRow,
  campaign: (typeof TOUR_CAMPAIGNS)[number]
) {
  const source = normalise(vote.source);

  return campaign.matchSources.some(
    (matchSource) => normalise(matchSource) === source
  );
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
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="text-sm text-zinc-400">{title}</div>
      <div className="mt-2 text-3xl font-semibold text-white">{value}</div>
      {subtitle ? (
        <div className="mt-2 text-sm text-zinc-500">{subtitle}</div>
      ) : null}
    </div>
  );
}

export default async function TourVotePage() {
  let votes: TourVoteRow[] = [];

  try {
    votes = await prisma.tourVote.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch {
    votes = [];
  }

  const campaignRows = await Promise.all(
    TOUR_CAMPAIGNS.map(async (campaign) => {
      const campaignVotes = votes.filter((vote) =>
        voteMatchesCampaign(vote, campaign)
      );

      const signupsToday = campaignVotes.filter((vote) =>
        isToday(vote.createdAt)
      ).length;

      const signupsTotal = campaignVotes.length;

      let adSpendToday = 0;
      let adSpendTotal = 0;

      if (campaign.metaCampaignId) {
        try {
          const meta = await getTourMetaSnapshot(campaign.metaCampaignId);

          adSpendToday =
            typeof meta?.spend?.today === "number" ? meta.spend.today : 0;

          adSpendTotal =
            typeof meta?.spend?.lifetime === "number"
              ? meta.spend.lifetime
              : 0;
        } catch {
          adSpendToday = 0;
          adSpendTotal = 0;
        }
      }

      const costPerSignupToday =
        signupsToday > 0 && adSpendToday > 0
          ? adSpendToday / signupsToday
          : 0;

      const costPerSignupTotal =
        signupsTotal > 0 && adSpendTotal > 0
          ? adSpendTotal / signupsTotal
          : 0;

      return {
        ...campaign,
        signupsToday,
        signupsTotal,
        adSpendToday,
        adSpendTotal,
        costPerSignupToday,
        costPerSignupTotal,
      };
    })
  );

  const totalSignupsToday = campaignRows.reduce(
    (sum, row) => sum + row.signupsToday,
    0
  );

  const totalSignups = campaignRows.reduce(
    (sum, row) => sum + row.signupsTotal,
    0
  );

  const totalAdSpendToday = campaignRows.reduce(
    (sum, row) => sum + row.adSpendToday,
    0
  );

  const totalAdSpend = campaignRows.reduce(
    (sum, row) => sum + row.adSpendTotal,
    0
  );

  const blendedCostPerSignupToday =
    totalSignupsToday > 0 && totalAdSpendToday > 0
      ? totalAdSpendToday / totalSignupsToday
      : 0;

  const blendedCostPerSignupTotal =
    totalSignups > 0 && totalAdSpend > 0 ? totalAdSpend / totalSignups : 0;

  return (
    <main className="min-h-screen bg-black px-6 py-8 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/" className="text-sm text-zinc-400 hover:text-white">
              ← Back to Mission Control
            </Link>

            <h1 className="mt-4 text-4xl font-bold tracking-tight">
              Tour Campaigns
            </h1>

            <p className="mt-2 max-w-3xl text-zinc-400">
              City-level signup and Meta spend tracking for pre-tour campaigns.
            </p>
          </div>
        </div>

        <section className="mb-8 grid gap-4 md:grid-cols-5">
          <KpiCard
            title="Signups Today"
            value={number(totalSignupsToday)}
            subtitle="Across all configured campaigns"
          />

          <KpiCard
            title="Total Signups"
            value={number(totalSignups)}
            subtitle="Across all configured campaigns"
          />

          <KpiCard
            title="Ad Spend Today"
            value={money(totalAdSpendToday)}
            subtitle="Meta campaign spend today"
          />

          <KpiCard
            title="CPS Today"
            value={
              blendedCostPerSignupToday > 0
                ? money(blendedCostPerSignupToday)
                : "—"
            }
            subtitle={
              totalSignupsToday > 0
                ? `${money(totalAdSpendToday)} / ${number(
                    totalSignupsToday
                  )} signups today`
                : "Waiting for today's first signup"
            }
          />

          <KpiCard
            title="CPS Total"
            value={
              blendedCostPerSignupTotal > 0
                ? money(blendedCostPerSignupTotal)
                : "—"
            }
            subtitle={
              totalSignups > 0
                ? `${money(totalAdSpend)} / ${number(totalSignups)} signups`
                : "Waiting for signups"
            }
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-xl font-semibold">Campaign performance</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Campaign rows now match signups by source only.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] text-left text-sm">
              <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-5 py-3">City</th>
                  <th className="px-5 py-3">Source</th>
                  <th className="px-5 py-3">Meta Campaign ID</th>
                  <th className="px-5 py-3 text-right">Signups Today</th>
                  <th className="px-5 py-3 text-right">Signups Total</th>
                  <th className="px-5 py-3 text-right">Ad Spend Today</th>
                  <th className="px-5 py-3 text-right">Ad Spend Total</th>
                  <th className="px-5 py-3 text-right">CPS Today</th>
                  <th className="px-5 py-3 text-right">CPS Total</th>
                </tr>
              </thead>

              <tbody>
                {campaignRows.map((row) => (
                  <tr key={row.source} className="border-b border-white/5">
                    <td className="px-5 py-4">
                      <div className="font-medium text-white">{row.city}</div>
                      <div className="text-xs text-zinc-500">{row.country}</div>
                    </td>

                    <td className="px-5 py-4 text-zinc-300">
                      <code className="rounded bg-white/10 px-2 py-1 text-xs">
                        {row.source}
                      </code>
                    </td>

                    <td className="px-5 py-4 text-zinc-400">
                      {row.metaCampaignId ? (
                        <code className="rounded bg-white/10 px-2 py-1 text-xs">
                          {row.metaCampaignId}
                        </code>
                      ) : (
                        "—"
                      )}
                    </td>

                    <td className="px-5 py-4 text-right text-zinc-200">
                      {number(row.signupsToday)}
                    </td>

                    <td className="px-5 py-4 text-right text-zinc-200">
                      {number(row.signupsTotal)}
                    </td>

                    <td className="px-5 py-4 text-right text-zinc-200">
                      {row.metaCampaignId ? money(row.adSpendToday) : "—"}
                    </td>

                    <td className="px-5 py-4 text-right text-zinc-200">
                      {row.metaCampaignId ? money(row.adSpendTotal) : "—"}
                    </td>

                    <td className="px-5 py-4 text-right font-medium text-white">
                      {row.costPerSignupToday > 0
                        ? money(row.costPerSignupToday)
                        : "—"}
                    </td>

                    <td className="px-5 py-4 text-right font-medium text-white">
                      {row.costPerSignupTotal > 0
                        ? money(row.costPerSignupTotal)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-xl font-semibold">Recent signups</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Latest submissions across all tour signup campaigns.
          </p>

          <div className="mt-5 grid gap-3">
            {votes.length === 0 ? (
              <div className="rounded-xl border border-white/10 p-4 text-sm text-zinc-400">
                No signups yet.
              </div>
            ) : (
              votes.slice(0, 12).map((vote) => (
                <div
                  key={vote.id}
                  className="rounded-xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="font-medium text-white">{vote.name}</div>
                      <div className="text-sm text-zinc-400">{vote.email}</div>
                    </div>

                    <div className="text-sm text-zinc-500">
                      {formatDateTime(vote.createdAt)}
                    </div>
                  </div>

                  <div className="mt-3 text-sm text-zinc-400">
                    Selected: {vote.selectedCity}, {vote.selectedCountry}
                    {vote.source ? (
                      <>
                        {" "}
                        · Source:{" "}
                        <code className="rounded bg-white/10 px-1 py-0.5 text-xs">
                          {vote.source}
                        </code>
                      </>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}