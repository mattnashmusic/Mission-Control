import { prisma } from "@/lib/prisma";
import {
  getProductItemKey,
  PRODUCT_ITEMS,
  type ProductItemKey,
} from "@/lib/products";

const PACE_WINDOW_DAYS = 30;

const DEFAULT_LEAD_TIMES: Record<
  ProductItemKey,
  { productionDays: number; shippingDays: number; bufferDays: number }
> = {
  cd1: { productionDays: 14, shippingDays: 7, bufferDays: 14 },
  cd2: { productionDays: 14, shippingDays: 7, bufferDays: 14 },
  vinyl: { productionDays: 56, shippingDays: 7, bufferDays: 14 },
};

export type StockStatus = "no-data" | "ok" | "reorder-soon" | "reorder-now";

export type StockSummary = {
  itemKey: ProductItemKey;
  itemName: string;
  currentStock: number | null;
  latestCount: { quantity: number; countedAt: Date; notes: string | null } | null;
  unitsSoldSinceCount: number;
  dailyPace30: number;
  daysOfStockLeft: number | null;
  leadTimeDays: number;
  productionDays: number;
  shippingDays: number;
  bufferDays: number;
  runOutDate: Date | null;
  orderByDate: Date | null;
  status: StockStatus;
};

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Sums units sold per physical product since a given date, combining line
 * items from every Shopify listing (funnel + store/"[Signed]") that maps to
 * that product via getProductItemKey. This is the one place that needs to
 * know about the funnel/store split so nothing else has to.
 */
async function getUnitsSoldByItemSince(
  sinceDate: Date,
): Promise<Record<ProductItemKey, number>> {
  const lineItems = await prisma.shopifyOrderLineItem.findMany({
    where: {
      shopifyOrder: {
        createdAt: { gte: sinceDate },
        orderNumber: { not: null },
      },
    },
    select: { title: true, quantity: true },
  });

  const totals: Record<ProductItemKey, number> = { cd1: 0, cd2: 0, vinyl: 0 };

  for (const item of lineItems) {
    const key = getProductItemKey(item.title);
    if (!key) continue;
    totals[key] += item.quantity;
  }

  return totals;
}

export async function getStockSummaries(): Promise<StockSummary[]> {
  const now = new Date();
  const paceWindowStart = addDays(now, -PACE_WINDOW_DAYS);

  const [latestCounts, settings, unitsSince30] = await Promise.all([
    prisma.stockCountEntry.findMany({
      orderBy: [{ itemKey: "asc" }, { countedAt: "desc" }],
    }),
    prisma.reorderSetting.findMany(),
    getUnitsSoldByItemSince(paceWindowStart),
  ]);

  const settingsByItem = new Map(settings.map((s) => [s.itemKey, s]));
  const latestByItem = new Map<string, (typeof latestCounts)[number]>();

  for (const entry of latestCounts) {
    if (!latestByItem.has(entry.itemKey)) {
      latestByItem.set(entry.itemKey, entry);
    }
  }

  const summaries: StockSummary[] = [];

  for (const product of PRODUCT_ITEMS) {
    const latest = latestByItem.get(product.itemKey) ?? null;
    const setting = settingsByItem.get(product.itemKey);
    const defaults = DEFAULT_LEAD_TIMES[product.itemKey];

    const productionDays = setting?.productionDays ?? defaults.productionDays;
    const shippingDays = setting?.shippingDays ?? defaults.shippingDays;
    const bufferDays = setting?.bufferDays ?? defaults.bufferDays;
    const leadTimeDays = productionDays + shippingDays + bufferDays;

    const dailyPace30 = unitsSince30[product.itemKey] / PACE_WINDOW_DAYS;

    let currentStock: number | null = null;
    let unitsSoldSinceCount = 0;

    if (latest) {
      const soldSinceCount = await getUnitsSoldByItemSince(latest.countedAt);
      unitsSoldSinceCount = soldSinceCount[product.itemKey];
      currentStock = latest.quantity - unitsSoldSinceCount;
    }

    const daysOfStockLeft =
      currentStock !== null && dailyPace30 > 0
        ? currentStock / dailyPace30
        : null;

    const runOutDate =
      currentStock !== null && dailyPace30 > 0
        ? addDays(now, currentStock / dailyPace30)
        : null;

    const orderByDate = runOutDate ? addDays(runOutDate, -leadTimeDays) : null;

    let status: StockStatus = "no-data";

    if (currentStock !== null) {
      if (daysOfStockLeft === null) {
        // Have a count but no recent sales pace to project from.
        status = "ok";
      } else if (daysOfStockLeft <= leadTimeDays) {
        status = "reorder-now";
      } else if (daysOfStockLeft <= leadTimeDays * 1.5) {
        status = "reorder-soon";
      } else {
        status = "ok";
      }
    }

    summaries.push({
      itemKey: product.itemKey,
      itemName: product.itemName,
      currentStock,
      latestCount: latest
        ? {
            quantity: latest.quantity,
            countedAt: latest.countedAt,
            notes: latest.notes,
          }
        : null,
      unitsSoldSinceCount,
      dailyPace30,
      daysOfStockLeft,
      leadTimeDays,
      productionDays,
      shippingDays,
      bufferDays,
      runOutDate,
      orderByDate,
      status,
    });
  }

  return summaries;
}
