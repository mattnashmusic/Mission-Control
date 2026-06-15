const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function toNumber(value) {
  if (value === undefined || value === null || value === "") return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

async function main() {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  if (!shop || !token) {
    throw new Error("Missing SHOPIFY_SHOP_DOMAIN or SHOPIFY_ADMIN_ACCESS_TOKEN");
  }

  const since = new Date();
  since.setDate(since.getDate() - 30);

  let url =
    `https://${shop}/admin/api/2024-10/orders.json` +
    `?status=any&limit=250&created_at_min=${encodeURIComponent(since.toISOString())}`;

  let ordersUpserted = 0;
  let lineItemsUpserted = 0;

  while (url) {
    const response = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Shopify fetch failed ${response.status}: ${text}`);
    }

    const data = await response.json();
    const orders = data.orders || [];

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
          orderNumber: order.order_number != null ? String(order.order_number) : null,
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
          subtotalPrice: await toNumber(order.current_subtotal_price),
          totalDiscounts: await toNumber(order.current_total_discounts),
          totalShipping: await toNumber(order.total_shipping_price_set?.shop_money?.amount),
          totalTax: await toNumber(order.current_total_tax),
          totalPrice: await toNumber(order.current_total_price),
          tags: order.tags ?? null,
          rawJson: order,
          syncedAt: new Date(),
        },
        create: {
          id: orderId,
          orderNumber: order.order_number != null ? String(order.order_number) : null,
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
          subtotalPrice: await toNumber(order.current_subtotal_price),
          totalDiscounts: await toNumber(order.current_total_discounts),
          totalShipping: await toNumber(order.total_shipping_price_set?.shop_money?.amount),
          totalTax: await toNumber(order.current_total_tax),
          totalPrice: await toNumber(order.current_total_price),
          tags: order.tags ?? null,
          rawJson: order,
          syncedAt: new Date(),
        },
      });

      ordersUpserted += 1;

      for (const item of order.line_items || []) {
        await prisma.shopifyOrderLineItem.upsert({
          where: { id: String(item.id) },
          update: {
            shopifyOrderId: orderId,
            title: item.title ?? "",
            sku: item.sku ?? null,
            variantTitle: item.variant_title ?? null,
            quantity: item.quantity ?? 1,
            price: await toNumber(item.price),
            vendor: item.vendor ?? null,
            productType: item.product_type ?? null,
            requiresShipping: item.requires_shipping ?? null,
            taxable: item.taxable ?? null,
            rawJson: item,
          },
          create: {
            id: String(item.id),
            shopifyOrderId: orderId,
            title: item.title ?? "",
            sku: item.sku ?? null,
            variantTitle: item.variant_title ?? null,
            quantity: item.quantity ?? 1,
            price: await toNumber(item.price),
            vendor: item.vendor ?? null,
            productType: item.product_type ?? null,
            requiresShipping: item.requires_shipping ?? null,
            taxable: item.taxable ?? null,
            rawJson: item,
          },
        });

        lineItemsUpserted += 1;
      }
    }

    const link = response.headers.get("link");
    const nextMatch = link?.match(/<([^>]+)>;\s*rel="next"/);
    url = nextMatch ? nextMatch[1] : "";
  }

  console.log({ ok: true, ordersUpserted, lineItemsUpserted });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
