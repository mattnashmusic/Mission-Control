import { prisma } from "@/lib/prisma";

type ShopifyOrderApi = {
  id: number | string;
  order_number?: number | string | null;
  name?: string | null;
  created_at: string;
  processed_at?: string | null;
  currency?: string | null;
  financial_status?: string | null;
  fulfillment_status?: string | null;
  display_fulfillment_status?: string | null;
  email?: string | null;
  tags?: string | null;
  current_subtotal_price?: string | number | null;
  current_total_discounts?: string | number | null;
  total_shipping_price_set?: {
    shop_money?: {
      amount?: string | number | null;
    } | null;
  } | null;
  current_total_tax?: string | number | null;
  current_total_price?: string | number | null;
  customer?: {
    id?: number | string | null;
    created_at?: string | null;
    updated_at?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    orders_count?: number | null;
    total_spent?: string | number | null;
    tags?: string | null;
    default_address?: {
      country?: string | null;
      country_code?: string | null;
    } | null;
  } | null;
  shipping_address?: {
    country?: string | null;
    country_code?: string | null;
  } | null;
  line_items?: Array<{
    id: number | string;
    title?: string | null;
    sku?: string | null;
    variant_title?: string | null;
    quantity?: number | null;
    price?: string | number | null;
    vendor?: string | null;
    product_type?: string | null;
    requires_shipping?: boolean | null;
    taxable?: boolean | null;
  }> | null;
};

type ShopifyCustomerApi = {
  id: number | string;
  created_at: string;
  updated_at?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  orders_count?: number | null;
  total_spent?: string | number | null;
  tags?: string | null;
  default_address?: {
    country?: string | null;
    country_code?: string | null;
  } | null;
};

type TokenResponse = {
  access_token: string;
  scope?: string;
  expires_in?: number;
};

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getShopifyEnv() {
  const shop = process.env.SHOPIFY_SHOP;
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;

  if (!shop || !clientId || !clientSecret) {
    throw new Error(
      "Missing SHOPIFY_SHOP, SHOPIFY_CLIENT_ID, or SHOPIFY_CLIENT_SECRET environment variable."
    );
  }

  return {
    shop,
    clientId,
    clientSecret,
  };
}

async function getShopifyAccessToken() {
  const { shop, clientId, clientSecret } = getShopifyEnv();

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(
    `https://${shop}.myshopify.com/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify token request failed: ${response.status} ${text}`);
  }

  const json = (await response.json()) as TokenResponse;

  if (!json.access_token) {
    throw new Error("Shopify token response did not include access_token.");
  }

  return {
    shop,
    accessToken: json.access_token,
  };
}

function getCreatedAtMinIso(daysBack: number) {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - daysBack);
  return cutoff.toISOString();
}

async function fetchPagedResource<T>(
  initialUrl: string,
  rootKey: "orders" | "customers"
): Promise<T[]> {
  const { accessToken } = await getShopifyAccessToken();

  let url = initialUrl;
  const allItems: T[] = [];

  while (url) {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Shopify ${rootKey} fetch failed: ${response.status} ${text}`
      );
    }

    const json = (await response.json()) as Record<string, T[] | undefined>;
    allItems.push(...(json[rootKey] ?? []));

    const linkHeader = response.headers.get("link");
    if (!linkHeader || !linkHeader.includes('rel="next"')) {
      url = "";
      continue;
    }

    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    url = nextMatch?.[1] ?? "";
  }

  return allItems;
}

async function fetchRecentOrders(
  daysBack: number = 2
): Promise<ShopifyOrderApi[]> {
  const { shop } = getShopifyEnv();
  const createdAtMin = getCreatedAtMinIso(daysBack);

  const initialUrl =
    `https://${shop}.myshopify.com/admin/api/2024-10/orders.json` +
    `?status=any` +
    `&limit=250` +
    `&order=created_at desc` +
    `&created_at_min=${encodeURIComponent(createdAtMin)}`;

  return fetchPagedResource<ShopifyOrderApi>(initialUrl, "orders");
}

async function fetchRecentCustomers(
  daysBack: number = 2
): Promise<ShopifyCustomerApi[]> {
  const { shop } = getShopifyEnv();
  const createdAtMin = getCreatedAtMinIso(daysBack);

  const initialUrl =
    `https://${shop}.myshopify.com/admin/api/2024-10/customers.json` +
    `?limit=250` +
    `&order=created_at desc` +
    `&created_at_min=${encodeURIComponent(createdAtMin)}`;

  return fetchPagedResource<ShopifyCustomerApi>(initialUrl, "customers");
}

async function fetchAllCustomers(): Promise<ShopifyCustomerApi[]> {
  const { shop } = getShopifyEnv();

  const initialUrl =
    `https://${shop}.myshopify.com/admin/api/2024-10/customers.json` +
    `?limit=250` +
    `&order=created_at desc`;

  return fetchPagedResource<ShopifyCustomerApi>(initialUrl, "customers");
}

async function upsertCustomer(customer: ShopifyCustomerApi) {
  await prisma.shopifyCustomer.upsert({
    where: { id: String(customer.id) },
    update: {
      createdAt: new Date(customer.created_at),
      updatedAtShopify: customer.updated_at
        ? new Date(customer.updated_at)
        : null,
      email: customer.email ?? null,
      firstName: customer.first_name ?? null,
      lastName: customer.last_name ?? null,
      ordersCount: customer.orders_count ?? 0,
      totalSpent: toNumber(customer.total_spent),
      country: customer.default_address?.country ?? null,
      countryCode: customer.default_address?.country_code ?? null,
      tags: customer.tags ?? null,
      rawJson: customer as unknown as object,
      syncedAt: new Date(),
    },
    create: {
      id: String(customer.id),
      createdAt: new Date(customer.created_at),
      updatedAtShopify: customer.updated_at
        ? new Date(customer.updated_at)
        : null,
      email: customer.email ?? null,
      firstName: customer.first_name ?? null,
      lastName: customer.last_name ?? null,
      ordersCount: customer.orders_count ?? 0,
      totalSpent: toNumber(customer.total_spent),
      country: customer.default_address?.country ?? null,
      countryCode: customer.default_address?.country_code ?? null,
      tags: customer.tags ?? null,
      rawJson: customer as unknown as object,
      syncedAt: new Date(),
    },
  });
}

export async function syncShopifyOrdersToDb(daysBack: number = 2) {
  const syncLog = await prisma.syncLog.create({
    data: {
      domain: "shopify-orders",
      status: "running",
      message: `Starting Shopify orders sync for last ${daysBack} days`,
    },
  });

  try {
    const orders = await fetchRecentOrders(daysBack);

    let ordersUpserted = 0;
    let lineItemsUpserted = 0;

    for (const order of orders) {
      const orderId = String(order.id);
      const shippingCountry =
        order.shipping_address?.country ??
        order.customer?.default_address?.country ??
        null;
      const shippingCountryCode =
        order.shipping_address?.country_code ??
        order.customer?.default_address?.country_code ??
        null;

      await prisma.shopifyOrder.upsert({
        where: { id: orderId },
        update: {
          orderNumber:
            order.order_number !== undefined && order.order_number !== null
              ? String(order.order_number)
              : null,
          name: order.name ?? null,
          createdAt: new Date(order.created_at),
          processedAt: order.processed_at ? new Date(order.processed_at) : null,
          currency: order.currency ?? null,
          financialStatus: order.financial_status ?? null,
          fulfillmentStatus: order.fulfillment_status ?? null,
          displayFulfillmentStatus: order.display_fulfillment_status ?? null,
          email: order.email ?? order.customer?.email ?? null,
          customerFirstName: order.customer?.first_name ?? null,
          customerLastName: order.customer?.last_name ?? null,
          customerCountry: shippingCountry,
          customerCountryCode: shippingCountryCode,
          subtotalPrice: toNumber(order.current_subtotal_price),
          totalDiscounts: toNumber(order.current_total_discounts),
          totalShipping: toNumber(
            order.total_shipping_price_set?.shop_money?.amount
          ),
          totalTax: toNumber(order.current_total_tax),
          totalPrice: toNumber(order.current_total_price),
          tags: order.tags ?? null,
          rawJson: order as unknown as object,
          syncedAt: new Date(),
        },
        create: {
          id: orderId,
          orderNumber:
            order.order_number !== undefined && order.order_number !== null
              ? String(order.order_number)
              : null,
          name: order.name ?? null,
          createdAt: new Date(order.created_at),
          processedAt: order.processed_at ? new Date(order.processed_at) : null,
          currency: order.currency ?? null,
          financialStatus: order.financial_status ?? null,
          fulfillmentStatus: order.fulfillment_status ?? null,
          displayFulfillmentStatus: order.display_fulfillment_status ?? null,
          email: order.email ?? order.customer?.email ?? null,
          customerFirstName: order.customer?.first_name ?? null,
          customerLastName: order.customer?.last_name ?? null,
          customerCountry: shippingCountry,
          customerCountryCode: shippingCountryCode,
          subtotalPrice: toNumber(order.current_subtotal_price),
          totalDiscounts: toNumber(order.current_total_discounts),
          totalShipping: toNumber(
            order.total_shipping_price_set?.shop_money?.amount
          ),
          totalTax: toNumber(order.current_total_tax),
          totalPrice: toNumber(order.current_total_price),
          tags: order.tags ?? null,
          rawJson: order as unknown as object,
          syncedAt: new Date(),
        },
      });

      ordersUpserted += 1;

      for (const item of order.line_items ?? []) {
        await prisma.shopifyOrderLineItem.upsert({
          where: { id: String(item.id) },
          update: {
            shopifyOrderId: orderId,
            title: item.title ?? "",
            sku: item.sku ?? null,
            variantTitle: item.variant_title ?? null,
            quantity: item.quantity ?? 1,
            price: toNumber(item.price),
            vendor: item.vendor ?? null,
            productType: item.product_type ?? null,
            requiresShipping: item.requires_shipping ?? null,
            taxable: item.taxable ?? null,
            rawJson: item as unknown as object,
          },
          create: {
            id: String(item.id),
            shopifyOrderId: orderId,
            title: item.title ?? "",
            sku: item.sku ?? null,
            variantTitle: item.variant_title ?? null,
            quantity: item.quantity ?? 1,
            price: toNumber(item.price),
            vendor: item.vendor ?? null,
            productType: item.product_type ?? null,
            requiresShipping: item.requires_shipping ?? null,
            taxable: item.taxable ?? null,
            rawJson: item as unknown as object,
          },
        });

        lineItemsUpserted += 1;
      }
    }

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "success",
        message: `Synced ${ordersUpserted} orders and ${lineItemsUpserted} line items from last ${daysBack} days`,
        finishedAt: new Date(),
      },
    });

    return {
      ok: true,
      daysBack,
      ordersUpserted,
      lineItemsUpserted,
    };
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown sync error",
        finishedAt: new Date(),
      },
    });

    throw error;
  }
}

export async function syncShopifyCustomersToDb(daysBack: number = 2) {
  const syncLog = await prisma.syncLog.create({
    data: {
      domain: "shopify-customers",
      status: "running",
      message: `Starting Shopify customers sync for last ${daysBack} days`,
    },
  });

  try {
    const customers = await fetchRecentCustomers(daysBack);

    let customersUpserted = 0;

    for (const customer of customers) {
      await upsertCustomer(customer);
      customersUpserted += 1;
    }

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "success",
        message: `Synced ${customersUpserted} customers from last ${daysBack} days`,
        finishedAt: new Date(),
      },
    });

    return {
      ok: true,
      daysBack,
      customersUpserted,
    };
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown sync error",
        finishedAt: new Date(),
      },
    });

    throw error;
  }
}

export async function backfillShopifyCustomersToDb() {
  const syncLog = await prisma.syncLog.create({
    data: {
      domain: "shopify-customers-backfill",
      status: "running",
      message: "Starting full Shopify customers backfill",
    },
  });

  try {
    const customers = await fetchAllCustomers();

    let customersUpserted = 0;

    for (const customer of customers) {
      await upsertCustomer(customer);
      customersUpserted += 1;
    }

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "success",
        message: `Backfilled ${customersUpserted} Shopify customers`,
        finishedAt: new Date(),
      },
    });

    return {
      ok: true,
      customersUpserted,
    };
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown backfill error",
        finishedAt: new Date(),
      },
    });

    throw error;
  }
}