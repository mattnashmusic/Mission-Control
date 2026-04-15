import SyncButton from "@/components/SyncButton";
import Link from "@/components/MobileNav";
import { prisma } from "@/lib/prisma";
import { getMetaSnapshot } from "@/lib/meta";
import { calculateShippingCost } from "@/utils/shipping";
import { getProductCost } from "@/utils/cogs";

const TIME_ZONE = "Europe/Amsterdam";
const PROCESSING_FEE_RATE = 0.029;
const PROCESSING_FIXED_FEE = 0.3;
const FSH_START_DATE = "2026-02-12";

// Tour placeholder stats for now
const NEXT_TOUR_DATE = "2026-11-20";
const UPCOMING_SHOWS = 8;
const TICKETS_SOLD = 563;

type DbDashboardOrder = {
  id: string;
  createdAt: string;
  country: string;
  revenueAmount: number;
  products: string;
};

type DbDashboardCustomer = {
  id: string;
  createdAt: string;
  email: string;
};

type DbTourVote = {
  id: string;
  createdAt: string;
  selectedCity: string;
};

function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
  }).format(Math.abs(value));
}

function signedMoney(value: number) {
  if (value > 0) return `+${money(value)}`;
  if (value < 0) return `-${money(Math.abs(value))}`;
  return money(0);
}

function ratio(value: number) {
  return value.toFixed(2);
}

function getDateKey(dateLike: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
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

function filterOrdersByDateKeys(
  orders: DbDashboardOrder[],
  dateKeys: Set<string>
) {
  return orders.filter((order) => dateKeys.has(getDateKey(order.createdAt)));
}

function filterCustomersByDateKeys(
  customers: DbDashboardCustomer[],
  dateKeys: Set<string>
) {
  return customers.filter(
    (customer) =>
      customer.email.trim() !== "" &&
      dateKeys.has(getDateKey(customer.createdAt))
  );
}

function filterCustomersSince(
  customers: DbDashboardCustomer[],
  startDate: Date
) {
  return customers.filter((customer) => {
    if (customer.email.trim() === "") return false;
    return new Date(customer.createdAt) >= startDate;
  });
}

function filterTourVotesByDateKeys(votes: DbTourVote[], dateKeys: Set<string>) {
  return votes.filter((vote) => dateKeys.has(getDateKey(vote.createdAt)));
}

function getTopCity(votes: DbTourVote[]) {
  if (votes.length === 0) {
    return "—";
  }

  const cityCounts = new Map<string, number>();

  for (const vote of votes) {
    cityCounts.set(vote.selectedCity, (cityCounts.get(vote.selectedCity) || 0) + 1);
  }

  return [...cityCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
}

function calculateRevenue(orders: DbDashboardOrder[]) {
  return orders.reduce((sum, order) => sum + order.revenueAmount, 0);
}

function calculateShipping(orders: DbDashboardOrder[]) {
  return orders.reduce((sum, order) => {
    return sum + calculateShippingCost(order.country, order.products);
  }, 0);
}

function calculateCogs(orders: DbDashboardOrder[]) {
  return orders.reduce((sum, order) => {
    return sum + getProductCost(order.products);
  }, 0);
}

function calculateProcessingFees(orders: DbDashboardOrder[]) {
  return orders.reduce((sum, order) => {
    return (
      sum + order.revenueAmount * PROCESSING_FEE_RATE + PROCESSING_FIXED_FEE
    );
  }, 0);
}

function calculateNetProfit(orders: DbDashboardOrder[], metaSpend: number) {
  const revenue = calculateRevenue(orders);
  const shipping = calculateShipping(orders);
  const cogs = calculateCogs(orders);
  const processingFees = calculateProcessingFees(orders);

  return revenue - shipping - cogs - processingFees - metaSpend;
}

function calculatePsm(
  revenue: number,
  productCosts: number,
  fulfillmentCosts: number,
  processingFees: number,
  adCosts: number
) {
  const totalCosts =
    productCosts + fulfillmentCosts + processingFees + adCosts;

  if (totalCosts === 0) return 0;
  return revenue / totalCosts;
}

function getPsmStatus(psm: number) {
  if (psm >= 1.1) {
    return {
      label: "Scaling",
      color: "text-emerald-400",
    };
  }

  if (psm >= 1.0) {
    return {
      label: "Break-even",
      color: "text-amber-400",
    };
  }

  return {
    label: "Unprofitable",
    color: "text-rose-400",
  };
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetweenInclusive(start: Date, end: Date) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(
    1,
    Math.floor(
      (startOfDay(end).getTime() - startOfDay(start).getTime()) / msPerDay
    ) + 1
  );
}

function daysUntil(dateString: string) {
  const now = new Date();
  const target = new Date(dateString);
  const msPerDay = 1000 * 60 * 60 * 24;

  return Math.max(
    0,
    Math.ceil(
      (startOfDay(target).getTime() - startOfDay(now).getTime()) / msPerDay
    )
  );
}

function HubCard({
  href,
  emoji,
  title,
  subtitle,
  stats,
}: {
  href: string;
  emoji: string;
  title: string;
  subtitle: string;
  stats: Array<{ label: string; value: string; valueClassName?: string }>;
}) {
  return (
    <a
      href={href}
      className="group rounded-3xl border border-zinc-800 bg-zinc-900/90 p-6 transition duration-200 hover:border-zinc-700 hover:bg-zinc-900 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.03)]"
    >
      <div className="mb-5">
        <div className="text-4xl">{emoji}</div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight text-white">
          {title}
        </h2>
        <p className="mt-1 text-sm text-zinc-400">{subtitle}</p>
      </div>

      <div className="space-y-3 border-t border-zinc-800 pt-5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex items-center justify-between gap-4"
          >
            <span className="text-sm text-zinc-400">{stat.label}</span>
            <span
              className={`text-sm font-medium ${
                stat.valueClassName ?? "text-zinc-100"
              }`}
            >
              {stat.value}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-6 text-sm font-medium text-zinc-500 transition group-hover:text-zinc-300">
        Open →
      </div>
    </a>
  );
}

export default async function Home() {
  let orders: DbDashboardOrder[] = [];
  let customers: DbDashboardCustomer[] = [];
  let tourVotes: DbTourVote[] = [];
  let metaSpendToday = 0;

  try {
    const dbOrders = await prisma.shopifyOrder.findMany({
      include: {
        lineItems: true,
      },
    });

    orders = dbOrders.map((order) => ({
      id: order.id,
      createdAt: order.createdAt.toISOString(),
      country: order.customerCountryCode || order.customerCountry || "NL",
      revenueAmount: order.totalPrice,
      products: order.lineItems
        .flatMap((item) =>
          Array.from({ length: Math.max(1, item.quantity) }, () => item.title)
        )
        .join(", "),
    }));
  } catch {
    orders = [];
  }

  try {
    const dbCustomers = await prisma.shopifyCustomer.findMany({
      select: {
        id: true,
        createdAt: true,
        email: true,
      },
    });

    customers = dbCustomers.map((customer) => ({
      id: customer.id,
      createdAt: customer.createdAt.toISOString(),
      email: customer.email ?? "",
    }));
  } catch {
    customers = [];
  }

  try {
    const dbTourVotes = await prisma.tourVote.findMany({
      select: {
        id: true,
        createdAt: true,
        selectedCity: true,
      },
    });

    tourVotes = dbTourVotes.map((vote) => ({
      id: vote.id,
      createdAt: vote.createdAt.toISOString(),
      selectedCity: vote.selectedCity,
    }));
  } catch {
    tourVotes = [];
  }

  try {
    const metaData = await getMetaSnapshot();
    metaSpendToday = metaData.spend.today;
  } catch {
    metaSpendToday = 0;
  }

  const todayOrders = filterOrdersByDateKeys(orders, buildRecentDateKeySet(1));

  const todayRevenue = calculateRevenue(todayOrders);
  const todayNetProfit = calculateNetProfit(todayOrders, metaSpendToday);
  const todayCogs = calculateCogs(todayOrders);
  const todayShipping = calculateShipping(todayOrders);
  const todayProcessingFees = calculateProcessingFees(todayOrders);
  const todayPsm = calculatePsm(
    todayRevenue,
    todayCogs,
    todayShipping,
    todayProcessingFees,
    metaSpendToday
  );
  const todayPsmStatus = getPsmStatus(todayPsm);

  const fshStartDate = new Date(FSH_START_DATE);
  const emailToday = filterCustomersByDateKeys(
    customers,
    buildRecentDateKeySet(1)
  ).length;
  const emailThirtyDay = filterCustomersByDateKeys(
    customers,
    buildRecentDateKeySet(30)
  ).length;
  const emailTotal = filterCustomersSince(customers, fshStartDate).length;
  const daysRunning = daysBetweenInclusive(fshStartDate, new Date());
  const avgEmailsPerDay = daysRunning > 0 ? emailTotal / daysRunning : 0;

  const tourVotesToday = filterTourVotesByDateKeys(
    tourVotes,
    buildRecentDateKeySet(1)
  ).length;
  const totalTourVotes = tourVotes.length;
  const topTourVoteCity = getTopCity(tourVotes);

  const daysToNextTour = daysUntil(NEXT_TOUR_DATE);
  const avgTicketsPerShow =
    UPCOMING_SHOWS > 0 ? TICKETS_SOLD / UPCOMING_SHOWS : 0;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <MobileNav />
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-12">
        <header className="mb-14 text-center">
          <p className="mb-3 text-sm uppercase tracking-[0.35em] text-zinc-500">
            Mission Control
          </p>
          <h1 className="text-5xl font-semibold tracking-tight text-white">
            🚀 Mission Control
          </h1>
          <p className="mt-4 text-lg text-zinc-400">Artist: Matt Nash</p>
          <div className="mt-6 flex justify-center">
            <SyncButton />
          </div>
        </header>

        <section className="mx-auto grid w-full max-w-5xl gap-6 md:grid-cols-2 xl:grid-cols-4">
          <HubCard
            href="/fsh"
            emoji="🎣"
            title="FSH"
            subtitle="Revenue engine"
            stats={[
              {
                label: "Revenue Today",
                value: money(todayRevenue),
              },
              {
                label: "Orders Today",
                value: String(todayOrders.length),
              },
              {
                label: "PSM",
                value: `${ratio(todayPsm)} · ${todayPsmStatus.label}`,
                valueClassName: todayPsmStatus.color,
              },
              {
                label: "Net Profit",
                value: signedMoney(todayNetProfit),
                valueClassName:
                  todayNetProfit >= 0 ? "text-emerald-400" : "text-rose-400",
              },
            ]}
          />

          <HubCard
            href="/email"
            emoji="📧"
            title="Email"
            subtitle="Audience engine"
            stats={[
              {
                label: "Total Contacts",
                value: String(emailTotal),
              },
              {
                label: "Collected Today",
                value: String(emailToday),
              },
              {
                label: "Last 30 Days",
                value: String(emailThirtyDay),
              },
              {
                label: "Avg / Day",
                value: avgEmailsPerDay.toFixed(1),
              },
            ]}
          />

          <HubCard
            href="/tour"
            emoji="🌎"
            title="Tour"
            subtitle="Demand engine"
            stats={[
              {
                label: "Days till next tour",
                value: String(daysToNextTour),
              },
              {
                label: "Upcoming Shows",
                value: String(UPCOMING_SHOWS),
              },
              {
                label: "Tix Sold",
                value: String(TICKETS_SOLD),
              },
              {
                label: "Avg / Show",
                value: avgTicketsPerShow.toFixed(0),
              },
            ]}
          />

          <HubCard
            href="/tour-vote"
            emoji="🗳️"
            title="Tour Vote / Signups"
            subtitle="Presale demand signals"
            stats={[
              {
                label: "Total Signups",
                value: String(totalTourVotes),
              },
              {
                label: "Today",
                value: String(tourVotesToday),
              },
              {
                label: "Top City",
                value: topTourVoteCity,
              },
              {
                label: "Meta Spend Today",
                value: money(metaSpendToday),
              },
            ]}
          />
        </section>

        <div className="mt-14 text-center text-sm text-zinc-500">
          Central hub for FSH, email growth, touring, and tour vote demand.
        </div>
      </div>
    </main>
  );
}