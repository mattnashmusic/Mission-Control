import { Fragment } from "react";
import { prisma } from "@/lib/prisma";
import { type DashboardCustomer } from "@/lib/shopify";
import { getMetaSnapshot } from "@/lib/meta";
import { calculateShippingCost } from "@/utils/shipping";
import { getProductCost } from "@/utils/cogs";
import SyncButton from "@/components/SyncButton";

const TIME_ZONE = "Europe/Amsterdam";
const PROCESSING_FEE_RATE = 0.029;
const PROCESSING_FIXED_FEE = 0.3;
const FSH_START_DATE = "2026-02-12";

type SpendSnapshot = {
  today: number;
  yesterday: number;
  sevenDay: number;
  thirtyDay: number;
  lifetime: number;
};

type PurchasesSnapshot = {
  today: number;
  yesterday: number;
  sevenDay: number;
  thirtyDay: number;
  lifetime: number;
};

type DashboardOrder = {
  id: string;
  name: string;
  date: string;
  createdAt: string;
  country: string;
  products: string;
  revenueAmount: number;
};

const PRODUCT_MATCHES = {
  cd2: ["rebirth cd deluxe"],
  vinyl: ["rebirth vinyl"],
  tips: ["tip"],
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

function percent(value: number) {
  return `${value.toFixed(1)}%`;
}

function signedPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function ratio(value: number) {
  return value.toFixed(2);
}

function formatLastSynced(date: Date | null) {
  if (!date) return "Never";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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

function shiftDateKey(date: Date, days: number) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() - days);
  return getDateKey(shifted);
}

function filterOrdersByDateKeys(
  orders: DashboardOrder[],
  dateKeys: Set<string>
) {
  return orders.filter((order) => dateKeys.has(getDateKey(order.createdAt)));
}

function filterCustomersByDateKeys(
  customers: DashboardCustomer[],
  dateKeys: Set<string>
) {
  return customers.filter(
    (customer) =>
      customer.email.trim() !== "" &&
      dateKeys.has(getDateKey(customer.createdAt))
  );
}

function filterCustomersSince(
  customers: DashboardCustomer[],
  startDate: Date
) {
  return customers.filter((customer) => {
    if (customer.email.trim() === "") return false;
    return new Date(customer.createdAt) >= startDate;
  });
}

function calculateRevenue(orders: DashboardOrder[]) {
  return orders.reduce((sum, order) => sum + order.revenueAmount, 0);
}

function calculateOrderCount(orders: DashboardOrder[]) {
  return orders.length;
}

function calculateAov(orders: DashboardOrder[]) {
  if (orders.length === 0) return 0;
  return calculateRevenue(orders) / orders.length;
}

function calculateShipping(orders: DashboardOrder[]) {
  return orders.reduce((sum, order) => {
    return sum + calculateShippingCost(order.country, order.products);
  }, 0);
}

function calculateCogs(orders: DashboardOrder[]) {
  return orders.reduce((sum, order) => {
    return sum + getProductCost(order.products);
  }, 0);
}

function calculateProcessingFees(orders: DashboardOrder[]) {
  return orders.reduce((sum, order) => {
    return (
      sum + order.revenueAmount * PROCESSING_FEE_RATE + PROCESSING_FIXED_FEE
    );
  }, 0);
}

function calculateNetProfit(orders: DashboardOrder[], metaSpend: number) {
  const revenue = calculateRevenue(orders);
  const shipping = calculateShipping(orders);
  const cogs = calculateCogs(orders);
  const processingFees = calculateProcessingFees(orders);

  return revenue - shipping - cogs - processingFees - metaSpend;
}

function calculateMargin(revenue: number, netProfit: number) {
  if (revenue === 0) return 0;
  return (netProfit / revenue) * 100;
}

function calculatePreviousPeriodChange(current: number, previous: number) {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return 100;
  return ((current - previous) / previous) * 100;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function orderHasAnyProductMatch(order: DashboardOrder, matches: string[]) {
  const products = normalizeText(order.products);
  return matches.some((match) => products.includes(normalizeText(match)));
}

function countOrdersWithAnyProductMatch(
  orders: DashboardOrder[],
  matches: string[]
) {
  return orders.filter((order) => orderHasAnyProductMatch(order, matches))
    .length;
}

function countProductsInOrder(order: DashboardOrder) {
  const raw = order.products?.trim();
  if (!raw) return 0;

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !normalizeText(item).includes("tip")).length;
}

function calculateTotalProducts(orders: DashboardOrder[]) {
  return orders.reduce((sum, order) => sum + countProductsInOrder(order), 0);
}

function calculateTakeRate(count: number, totalOrders: number) {
  if (totalOrders === 0) return 0;
  return (count / totalOrders) * 100;
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

function logPerf(label: string, startedAt: number, extra?: Record<string, unknown>) {
  const durationMs = Date.now() - startedAt;
  if (extra) {
    console.log(`[FSH PERF] ${label}: ${durationMs}ms`, extra);
    return;
  }

  console.log(`[FSH PERF] ${label}: ${durationMs}ms`);
}

function TodayCard({
  title,
  emoji,
  value,
  valueClassName = "text-white",
  lines,
}: {
  title: string;
  emoji: string;
  value: string;
  valueClassName?: string;
  lines: Array<{ label: string; value: string; valueClassName?: string }>;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5">
      <div className="mb-2 text-base font-semibold text-zinc-200">
        {emoji} {title}
      </div>

      <div
        className={`text-3xl font-semibold tracking-tight tabular-nums ${valueClassName}`}
      >
        {value}
      </div>

      <div className="mt-4 space-y-2 border-t border-zinc-800 pt-4">
        {lines.map((line) => (
          <div
            key={line.label}
            className="flex items-center justify-between gap-3"
          >
            <span className="text-sm text-zinc-400">{line.label}</span>
            <span
              className={`text-sm font-medium tabular-nums ${
                line.valueClassName ?? "text-zinc-200"
              }`}
            >
              {line.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PerformanceRow({
  label,
  yesterday,
  sevenDay,
  thirtyDay,
  lifetime,
  emphasize = false,
}: {
  label: string;
  yesterday: string;
  sevenDay: string;
  thirtyDay: string;
  lifetime: string;
  emphasize?: boolean;
}) {
  return (
    <tr className="border-t border-zinc-800">
      <td className="px-4 py-4 text-sm font-medium text-zinc-200">{label}</td>
      <td
        className={`px-4 py-4 text-right text-sm tabular-nums ${
          emphasize ? "font-semibold text-white" : "text-zinc-300"
        }`}
      >
        {yesterday}
      </td>
      <td
        className={`px-4 py-4 text-right text-sm tabular-nums ${
          emphasize ? "font-semibold text-white" : "text-zinc-300"
        }`}
      >
        {sevenDay}
      </td>
      <td
        className={`px-4 py-4 text-right text-sm tabular-nums ${
          emphasize ? "font-semibold text-white" : "text-zinc-300"
        }`}
      >
        {thirtyDay}
      </td>
      <td
        className={`px-4 py-4 text-right text-sm tabular-nums ${
          emphasize ? "font-semibold text-white" : "text-zinc-300"
        }`}
      >
        {lifetime}
      </td>
    </tr>
  );
}

function BottomStatCard({
  label,
  value,
  valueClassName = "text-white",
}: {
  label: string;
  value: string | number;
  valueClassName?: string;
}) {
  return (
    <div className="flex h-full min-h-[124px] flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
        {label}
      </p>
      <p className={`mt-4 text-2xl font-semibold tabular-nums ${valueClassName}`}>
        {value}
      </p>
    </div>
  );
}

export default async function Home() {
  const pageStartedAt = Date.now();
  console.log("[FSH PERF] page render start");

  let orders: DashboardOrder[] = [];
  let customers: DashboardCustomer[] = [];
  let shopifyError = "";
  let customerError = "";
  let metaError = "";

  let metaSpend: SpendSnapshot = {
    today: 0,
    yesterday: 0,
    sevenDay: 0,
    thirtyDay: 0,
    lifetime: 0,
  };

  let metaPurchases: PurchasesSnapshot = {
    today: 0,
    yesterday: 0,
    sevenDay: 0,
    thirtyDay: 0,
    lifetime: 0,
  };

  let metaDailyBudget: number | null = null;

  const lastSyncStartedAt = Date.now();
  const lastSync = await prisma.syncLog.findFirst({
    where: {
      domain: {
        in: ["sync-all", "cron-sync"],
      },
      status: "success",
    },
    orderBy: {
      finishedAt: "desc",
    },
  });
  logPerf("syncLog.findFirst", lastSyncStartedAt);

  try {
    const ordersQueryStartedAt = Date.now();

    const dbOrders = await prisma.shopifyOrder.findMany({
      include: {
        lineItems: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    logPerf("shopifyOrder.findMany", ordersQueryStartedAt, {
      rows: dbOrders.length,
    });

    const mapOrdersStartedAt = Date.now();

    orders = dbOrders.map((order) => ({
      id: order.id,
      name: order.name || `#${order.orderNumber || order.id}`,
      date: new Intl.DateTimeFormat("en-GB", {
        timeZone: TIME_ZONE,
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(order.createdAt),
      createdAt: order.createdAt.toISOString(),
      country: order.customerCountryCode || order.customerCountry || "—",
      products: order.lineItems
        .flatMap((item) =>
          Array.from({ length: Math.max(1, item.quantity) }, () => item.title)
        )
        .join(", "),
      revenueAmount: order.totalPrice,
    }));

    logPerf("map shopify orders", mapOrdersStartedAt, {
      mappedRows: orders.length,
    });
  } catch (error) {
    shopifyError =
      error instanceof Error ? error.message : "Unknown Shopify orders error";

    console.error("[FSH PERF] shopify orders failed", error);
  }

  try {
    const customersQueryStartedAt = Date.now();

    const dbCustomers = await prisma.shopifyCustomer.findMany({
      select: {
        id: true,
        createdAt: true,
        email: true,
        firstName: true,
        lastName: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    logPerf("shopifyCustomer.findMany", customersQueryStartedAt, {
      rows: dbCustomers.length,
    });

    const mapCustomersStartedAt = Date.now();

    customers = dbCustomers.map((customer) => ({
      id: customer.id,
      email: customer.email?.trim() || "",
      createdAt: customer.createdAt.toISOString(),
      date: new Intl.DateTimeFormat("en-GB", {
        timeZone: TIME_ZONE,
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      }).format(customer.createdAt),
      name:
        [customer.firstName ?? "", customer.lastName ?? ""].join(" ").trim() ||
        "—",
    }));

    logPerf("map shopify customers", mapCustomersStartedAt, {
      mappedRows: customers.length,
    });
  } catch (error) {
    customerError =
      error instanceof Error ? error.message : "Unknown Shopify customers error";
    customers = [];
    console.error("[FSH PERF] shopify customers failed", error);
  }

  try {
    const metaStartedAt = Date.now();
    const meta = await getMetaSnapshot();
    logPerf("getMetaSnapshot", metaStartedAt, {
      spendToday: meta.spend.today,
      dailyBudget: meta.dailyBudget,
      salesTrackedToday: meta.salesTrackedToday,
    });

    metaSpend = {
      today: meta.spend.today,
      yesterday: meta.spend.yesterday,
      sevenDay: meta.spend.sevenDay,
      thirtyDay: meta.spend.thirtyDay,
      lifetime: meta.spend.lifetime,
    };

    metaPurchases = {
      today: meta.salesTrackedToday,
      yesterday: 0,
      sevenDay: 0,
      thirtyDay: 0,
      lifetime: 0,
    };

    metaDailyBudget = meta.dailyBudget;
  } catch (error) {
    metaError = error instanceof Error ? error.message : "Unknown Meta error";
    console.error("[FSH PERF] meta snapshot failed", error);
  }

  const calculationsStartedAt = Date.now();

  const todayKey = getDateKey(new Date());

  const todayOrders = filterOrdersByDateKeys(orders, buildRecentDateKeySet(1));
  const sevenDayOrders = filterOrdersByDateKeys(
    orders,
    buildRecentDateKeySet(7)
  );
  const thirtyDayOrders = filterOrdersByDateKeys(
    orders,
    buildRecentDateKeySet(30)
  );
  const lifetimeOrders = orders;
  const yesterdayOrders = filterOrdersByDateKeys(
    orders,
    new Set([shiftDateKey(new Date(), 1)])
  );

  const revenueValues = {
    today: calculateRevenue(todayOrders),
    yesterday: calculateRevenue(yesterdayOrders),
    sevenDay: calculateRevenue(sevenDayOrders),
    thirtyDay: calculateRevenue(thirtyDayOrders),
    lifetime: calculateRevenue(lifetimeOrders),
  };

  const orderValues = {
    today: calculateOrderCount(todayOrders),
    yesterday: calculateOrderCount(yesterdayOrders),
    sevenDay: calculateOrderCount(sevenDayOrders),
    thirtyDay: calculateOrderCount(thirtyDayOrders),
    lifetime: calculateOrderCount(lifetimeOrders),
  };

  const aovValues = {
    today: calculateAov(todayOrders),
    yesterday: calculateAov(yesterdayOrders),
    sevenDay: calculateAov(sevenDayOrders),
    thirtyDay: calculateAov(thirtyDayOrders),
    lifetime: calculateAov(lifetimeOrders),
  };

  const shippingValues = {
    today: calculateShipping(todayOrders),
    yesterday: calculateShipping(yesterdayOrders),
    sevenDay: calculateShipping(sevenDayOrders),
    thirtyDay: calculateShipping(thirtyDayOrders),
    lifetime: calculateShipping(lifetimeOrders),
  };

  const cogsValues = {
    today: calculateCogs(todayOrders),
    yesterday: calculateCogs(yesterdayOrders),
    sevenDay: calculateCogs(sevenDayOrders),
    thirtyDay: calculateCogs(thirtyDayOrders),
    lifetime: calculateCogs(lifetimeOrders),
  };

  const processingFeeValues = {
    today: calculateProcessingFees(todayOrders),
    yesterday: calculateProcessingFees(yesterdayOrders),
    sevenDay: calculateProcessingFees(sevenDayOrders),
    thirtyDay: calculateProcessingFees(thirtyDayOrders),
    lifetime: calculateProcessingFees(lifetimeOrders),
  };

  const metaValues = {
    today: metaError ? null : metaSpend.today,
    yesterday: metaError ? null : metaSpend.yesterday,
    sevenDay: metaError ? null : metaSpend.sevenDay,
    thirtyDay: metaError ? null : metaSpend.thirtyDay,
    lifetime: metaError ? null : metaSpend.lifetime,
  };

  const netProfitValues = {
    today: calculateNetProfit(todayOrders, metaSpend.today),
    yesterday: calculateNetProfit(yesterdayOrders, metaSpend.yesterday),
    sevenDay: calculateNetProfit(sevenDayOrders, metaSpend.sevenDay),
    thirtyDay: calculateNetProfit(thirtyDayOrders, metaSpend.thirtyDay),
    lifetime: calculateNetProfit(lifetimeOrders, metaSpend.lifetime),
  };

  const revenueVsYesterday = calculatePreviousPeriodChange(
    revenueValues.today,
    revenueValues.yesterday
  );

  const todayCd2Count = countOrdersWithAnyProductMatch(
    todayOrders,
    PRODUCT_MATCHES.cd2
  );
  const todayCd2TakeRate = calculateTakeRate(todayCd2Count, orderValues.today);

  const todayVinylCount = countOrdersWithAnyProductMatch(
    todayOrders,
    PRODUCT_MATCHES.vinyl
  );
  const todayVinylTakeRate = calculateTakeRate(
    todayVinylCount,
    orderValues.today
  );

  const todayTipsCount = countOrdersWithAnyProductMatch(
    todayOrders,
    PRODUCT_MATCHES.tips
  );
  const todayTipsTakeRate = calculateTakeRate(
    todayTipsCount,
    orderValues.today
  );

  const todayTotalProducts = calculateTotalProducts(todayOrders);

  const aovVsSevenDay = calculatePreviousPeriodChange(
    aovValues.today,
    aovValues.sevenDay
  );

  const netProfitMarginToday = calculateMargin(
    revenueValues.today,
    netProfitValues.today
  );

  const psmValues = {
    today: calculatePsm(
      revenueValues.today,
      cogsValues.today,
      shippingValues.today,
      processingFeeValues.today,
      metaSpend.today
    ),
    yesterday: calculatePsm(
      revenueValues.yesterday,
      cogsValues.yesterday,
      shippingValues.yesterday,
      processingFeeValues.yesterday,
      metaSpend.yesterday
    ),
    sevenDay: calculatePsm(
      revenueValues.sevenDay,
      cogsValues.sevenDay,
      shippingValues.sevenDay,
      processingFeeValues.sevenDay,
      metaSpend.sevenDay
    ),
    thirtyDay: calculatePsm(
      revenueValues.thirtyDay,
      cogsValues.thirtyDay,
      shippingValues.thirtyDay,
      processingFeeValues.thirtyDay,
      metaSpend.thirtyDay
    ),
    lifetime: calculatePsm(
      revenueValues.lifetime,
      cogsValues.lifetime,
      shippingValues.lifetime,
      processingFeeValues.lifetime,
      metaSpend.lifetime
    ),
  };

  const todayPsmStatus = getPsmStatus(psmValues.today);

  const fshStartDate = new Date(FSH_START_DATE);
  const daysRunning = daysBetweenInclusive(fshStartDate, new Date());

  const emailValues = {
    today: filterCustomersByDateKeys(customers, buildRecentDateKeySet(1)).length,
    thirtyDay: filterCustomersByDateKeys(customers, buildRecentDateKeySet(30))
      .length,
    total: filterCustomersSince(customers, fshStartDate).length,
  };

  const lifetimeCd2Count = countOrdersWithAnyProductMatch(
    lifetimeOrders,
    PRODUCT_MATCHES.cd2
  );
  const lifetimeCd2TakeRate = calculateTakeRate(
    lifetimeCd2Count,
    orderValues.lifetime
  );

  const lifetimeVinylCount = countOrdersWithAnyProductMatch(
    lifetimeOrders,
    PRODUCT_MATCHES.vinyl
  );
  const lifetimeVinylTakeRate = calculateTakeRate(
    lifetimeVinylCount,
    orderValues.lifetime
  );

  const recentOrders = [...orders].slice(0, 10);
  const firstNonTodayRecentOrderIndex = recentOrders.findIndex(
    (order) => getDateKey(order.createdAt) !== todayKey
  );

  logPerf("dashboard calculations", calculationsStartedAt, {
    totalOrders: orders.length,
    totalCustomers: customers.length,
    todayOrders: todayOrders.length,
    yesterdayOrders: yesterdayOrders.length,
    sevenDayOrders: sevenDayOrders.length,
    thirtyDayOrders: thirtyDayOrders.length,
    recentOrders: recentOrders.length,
  });

  logPerf("page render total", pageStartedAt, {
    shopifyError: shopifyError || null,
    customerError: customerError || null,
    metaError: metaError || null,
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
                FSH Dashboard
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                🎣 FSH Dashboard
              </h1>
              <p className="mt-3 max-w-3xl text-base text-zinc-400 sm:text-lg">
                Clean overview of revenue, orders, spend, costs, and net profit.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-zinc-400">
                <span>Running for {daysRunning} days</span>
                <span>Started {FSH_START_DATE}</span>
              </div>
            </div>

            <div className="flex w-full flex-col gap-4 lg:w-[320px] lg:min-w-[320px] lg:max-w-[320px] lg:flex-none">
              <div className="flex flex-col items-start lg:items-end">
                <SyncButton />
                <span className="mt-1 text-xs text-zinc-500">
                  Last synced: {formatLastSynced(lastSync?.finishedAt ?? null)}
                </span>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-4 lg:ml-auto lg:w-[320px]">
                <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Emails Collected ✉️
                </div>
                <div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-white">
                  {emailValues.total}
                </div>
                <div className="mt-2 text-sm text-zinc-400">
                  {emailValues.today} today · {emailValues.thirtyDay} last 30d
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <TodayCard
            title="Revenue"
            emoji="💸"
            value={money(revenueValues.today)}
            lines={[
              {
                label: "vs Yesterday",
                value: signedPercent(revenueVsYesterday),
                valueClassName:
                  revenueVsYesterday >= 0
                    ? "text-emerald-400"
                    : "text-rose-400",
              },
            ]}
          />

          <TodayCard
            title="Orders"
            emoji="📦"
            value={String(orderValues.today)}
            lines={[
              {
                label: "Total Products",
                value: String(todayTotalProducts),
              },
              {
                label: "CD2",
                value: `${todayCd2Count} (${percent(todayCd2TakeRate)})`,
              },
              {
                label: "Vinyl",
                value: `${todayVinylCount} (${percent(todayVinylTakeRate)})`,
              },
              {
                label: "Tips",
                value: `${todayTipsCount} (${percent(todayTipsTakeRate)})`,
              },
            ]}
          />

          <TodayCard
            title="AOV"
            emoji="📊"
            value={money(aovValues.today)}
            lines={[
              {
                label: "vs 7 Day Avg",
                value: signedPercent(aovVsSevenDay),
                valueClassName:
                  aovVsSevenDay >= 0 ? "text-emerald-400" : "text-rose-400",
              },
            ]}
          />

          <TodayCard
            title="Meta Spend"
            emoji="📣"
            value={metaError ? "—" : money(metaSpend.today)}
            lines={[
              {
                label: "Sales Tracked",
                value: metaError ? "—" : String(metaPurchases.today),
              },
              {
                label: "Daily Budget",
                value:
                  metaError || metaDailyBudget === null
                    ? "—"
                    : money(metaDailyBudget),
              },
            ]}
          />

          <TodayCard
            title="Net Profit"
            emoji={netProfitValues.today >= 0 ? "🟢" : "🔴"}
            value={signedMoney(netProfitValues.today)}
            valueClassName={
              netProfitValues.today >= 0
                ? "text-emerald-400"
                : "text-rose-400"
            }
            lines={[
              {
                label: "Margin",
                value: percent(netProfitMarginToday),
                valueClassName:
                  netProfitMarginToday >= 0
                    ? "text-emerald-400"
                    : "text-rose-400",
              },
            ]}
          />

          <TodayCard
            title="PSM"
            emoji="🎯"
            value={ratio(psmValues.today)}
            valueClassName={todayPsmStatus.color}
            lines={[
              {
                label: "Yesterday",
                value: ratio(psmValues.yesterday),
              },
              {
                label: "7D",
                value: ratio(psmValues.sevenDay),
              },
              {
                label: "30D",
                value: ratio(psmValues.thirtyDay),
              },
              {
                label: "Lifetime",
                value: ratio(psmValues.lifetime),
              },
            ]}
          />
        </section>

        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5">
          <div className="mb-4">
            <h2 className="text-2xl font-semibold text-white">
              Performance Overview
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Net profit is after ad spend, shipping, processing fees, and COGS.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-zinc-800">
            <table className="w-full min-w-[760px] text-left">
              <thead className="bg-zinc-800/70">
                <tr>
                  <th className="px-4 py-3 text-sm font-medium text-zinc-300">
                    Metric
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-zinc-300">
                    Yesterday
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-zinc-300">
                    7 Days
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-zinc-300">
                    30 Days
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-zinc-300">
                    Lifetime
                  </th>
                </tr>
              </thead>

              <tbody className="bg-zinc-900/50">
                <PerformanceRow
                  label="Revenue"
                  yesterday={money(revenueValues.yesterday)}
                  sevenDay={money(revenueValues.sevenDay)}
                  thirtyDay={money(revenueValues.thirtyDay)}
                  lifetime={money(revenueValues.lifetime)}
                />

                <PerformanceRow
                  label="Orders"
                  yesterday={String(orderValues.yesterday)}
                  sevenDay={String(orderValues.sevenDay)}
                  thirtyDay={String(orderValues.thirtyDay)}
                  lifetime={String(orderValues.lifetime)}
                />

                <PerformanceRow
                  label="AOV"
                  yesterday={money(aovValues.yesterday)}
                  sevenDay={money(aovValues.sevenDay)}
                  thirtyDay={money(aovValues.thirtyDay)}
                  lifetime={money(aovValues.lifetime)}
                />

                <PerformanceRow
                  label="Shipping"
                  yesterday={money(shippingValues.yesterday)}
                  sevenDay={money(shippingValues.sevenDay)}
                  thirtyDay={money(shippingValues.thirtyDay)}
                  lifetime={money(shippingValues.lifetime)}
                />

                <PerformanceRow
                  label="Processing Fees"
                  yesterday={money(processingFeeValues.yesterday)}
                  sevenDay={money(processingFeeValues.sevenDay)}
                  thirtyDay={money(processingFeeValues.thirtyDay)}
                  lifetime={money(processingFeeValues.lifetime)}
                />

                <PerformanceRow
                  label="COGS"
                  yesterday={money(cogsValues.yesterday)}
                  sevenDay={money(cogsValues.sevenDay)}
                  thirtyDay={money(cogsValues.thirtyDay)}
                  lifetime={money(cogsValues.lifetime)}
                />

                <PerformanceRow
                  label="Meta Spend"
                  yesterday={
                    metaValues.yesterday === null
                      ? "—"
                      : money(metaValues.yesterday)
                  }
                  sevenDay={
                    metaValues.sevenDay === null
                      ? "—"
                      : money(metaValues.sevenDay)
                  }
                  thirtyDay={
                    metaValues.thirtyDay === null
                      ? "—"
                      : money(metaValues.thirtyDay)
                  }
                  lifetime={
                    metaValues.lifetime === null
                      ? "—"
                      : money(metaValues.lifetime)
                  }
                />

                <PerformanceRow
                  label="Net Profit"
                  yesterday={signedMoney(netProfitValues.yesterday)}
                  sevenDay={signedMoney(netProfitValues.sevenDay)}
                  thirtyDay={signedMoney(netProfitValues.thirtyDay)}
                  lifetime={signedMoney(netProfitValues.lifetime)}
                  emphasize
                />

                <PerformanceRow
                  label="PSM"
                  yesterday={ratio(psmValues.yesterday)}
                  sevenDay={ratio(psmValues.sevenDay)}
                  thirtyDay={ratio(psmValues.thirtyDay)}
                  lifetime={ratio(psmValues.lifetime)}
                  emphasize
                />
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <BottomStatCard
              label="Total Orders"
              value={orderValues.lifetime}
            />

            <BottomStatCard
              label="Lifetime Net Profit"
              value={signedMoney(netProfitValues.lifetime)}
              valueClassName={
                netProfitValues.lifetime >= 0
                  ? "text-emerald-400"
                  : "text-rose-400"
              }
            />

            <BottomStatCard
              label="CD2 Upsell Takers"
              value={lifetimeCd2Count}
            />

            <BottomStatCard
              label="CD2 Take Rate"
              value={percent(lifetimeCd2TakeRate)}
            />

            <BottomStatCard
              label="Vinyl Upsell Takers"
              value={lifetimeVinylCount}
            />

            <BottomStatCard
              label="Vinyl Take Rate"
              value={percent(lifetimeVinylTakeRate)}
            />
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[2fr_1fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5">
            <div className="mb-4">
              <h3 className="text-2xl font-semibold text-white">
                Recent Orders
              </h3>
              <p className="text-sm text-zinc-400">
                Latest Shopify orders pulled directly into the dashboard.
              </p>
            </div>

            {shopifyError ? (
              <div className="rounded-2xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
                {shopifyError}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-zinc-800">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-zinc-800/70 text-zinc-300">
                    <tr>
                      <th className="px-4 py-3 font-medium">Order</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Country</th>
                      <th className="px-4 py-3 font-medium">Products</th>
                      <th className="px-4 py-3 text-right font-medium">
                        Revenue
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.length === 0 ? (
                      <tr className="border-t border-zinc-800">
                        <td className="px-4 py-4 text-zinc-500" colSpan={5}>
                          No orders found yet.
                        </td>
                      </tr>
                    ) : (
                      recentOrders.map((order, index) => {
                        const isTodayOrder =
                          getDateKey(order.createdAt) === todayKey;
                        const showTodayDivider = index === 0 && isTodayOrder;
                        const showEarlierDivider =
                          firstNonTodayRecentOrderIndex !== -1 &&
                          index === firstNonTodayRecentOrderIndex;

                        return (
                          <Fragment key={order.id}>
                            {showTodayDivider ? (
                              <tr className="border-t border-zinc-800 bg-zinc-950/60">
                                <td
                                  className="px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400"
                                  colSpan={5}
                                >
                                  Today
                                </td>
                              </tr>
                            ) : null}

                            {showEarlierDivider ? (
                              <tr className="border-t border-zinc-800 bg-zinc-950/60">
                                <td
                                  className="px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400"
                                  colSpan={5}
                                >
                                  Earlier
                                </td>
                              </tr>
                            ) : null}

                            <tr className="border-t border-zinc-800">
                              <td className="px-4 py-4">{order.name}</td>
                              <td className="px-4 py-4 text-zinc-400">
                                {order.date}
                              </td>
                              <td className="px-4 py-4 text-zinc-400">
                                {order.country}
                              </td>
                              <td className="px-4 py-4 text-zinc-400">
                                {order.products}
                              </td>
                              <td className="px-4 py-4 text-right tabular-nums">
                                {money(order.revenueAmount)}
                              </td>
                            </tr>
                          </Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/90 p-5">
            <h3 className="text-2xl font-semibold text-white">Sync Status</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Current connection state for your dashboard.
            </p>

            <div className="mt-6 space-y-5">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Last Synced
                </p>
                <p className="mt-2 text-lg font-medium text-zinc-100">
                  {formatLastSynced(lastSync?.finishedAt ?? null)}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Shopify Orders
                </p>
                <p className="mt-2 text-lg font-medium text-emerald-400">
                  {shopifyError ? "Connection issue" : "Connected"}
                </p>
                {shopifyError ? (
                  <p className="mt-2 text-sm text-red-300">{shopifyError}</p>
                ) : null}
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Shopify Customers
                </p>
                <p className="mt-2 text-lg font-medium text-emerald-400">
                  {customerError ? "Connection issue" : "Connected"}
                </p>
                {customerError ? (
                  <p className="mt-2 text-sm text-red-300">{customerError}</p>
                ) : null}
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Meta
                </p>
                <p
                  className={`mt-2 text-lg font-medium ${
                    metaError ? "text-amber-400" : "text-emerald-400"
                  }`}
                >
                  {metaError ? "Connection issue" : "Connected"}
                </p>
                {metaError ? (
                  <p className="mt-2 text-sm text-red-300">{metaError}</p>
                ) : null}
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  Emails
                </p>
                <p className="mt-2 text-lg font-medium text-zinc-100">
                  {emailValues.total} total
                </p>
                <p className="mt-2 text-sm text-zinc-400">
                  {emailValues.today} today · {emailValues.thirtyDay} last 30d
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}