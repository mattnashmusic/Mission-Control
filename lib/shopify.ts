type ShopifyMoney = {
  amount: string;
  currencyCode: string;
};

type ShopifyOrderNode = {
  id: string;
  name: string;
  createdAt: string;
  totalPriceSet: {
    shopMoney: ShopifyMoney;
  };
  shippingAddress:
    | {
        countryCodeV2?: string;
        country?: string;
      }
    | null;
  lineItems: {
    edges: Array<{
      node: {
        title: string;
        quantity: number;
      };
    }>;
  };
};

type ShopifyCustomerNode = {
  id: string;
  email: string | null;
  createdAt: string;
  firstName: string | null;
  lastName: string | null;
};

type ShopifyOrdersResponse = {
  data?: {
    orders?: {
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      edges: Array<{
        node: ShopifyOrderNode;
      }>;
    };
  };
  errors?: Array<{
    message: string;
  }>;
};

type ShopifyCustomersResponse = {
  data?: {
    customers?: {
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      edges: Array<{
        node: ShopifyCustomerNode;
      }>;
    };
  };
  errors?: Array<{
    message: string;
  }>;
};

export type DashboardOrder = {
  id: string;
  name: string;
  createdAt: string;
  date: string;
  country: string;
  products: string;
  revenueAmount: number;
  currencyCode: string;
};

export type DashboardCustomer = {
  id: string;
  email: string;
  createdAt: string;
  date: string;
  name: string;
};

const SHOP = process.env.SHOPIFY_SHOP;
const CLIENT_ID = process.env.SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SHOPIFY_CLIENT_SECRET;
const TIME_ZONE = "Europe/Amsterdam";

let accessTokenPromise: Promise<string> | null = null;

function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function formatOrderDate(dateString: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function formatCustomerDate(dateString: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(dateString));
}

function formatCustomerName(
  firstName: string | null,
  lastName: string | null
): string {
  const name = [firstName ?? "", lastName ?? ""].join(" ").trim();
  return name || "—";
}

function getDateKey(dateLike: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dateLike));
}

function mapOrderNode(node: ShopifyOrderNode): DashboardOrder {
  const products = node.lineItems.edges
    .flatMap((itemEdge) =>
      Array.from({ length: Math.max(1, itemEdge.node.quantity) }, () => itemEdge.node.title)
    )
    .join(", ");

  return {
    id: node.id,
    name: node.name,
    createdAt: node.createdAt,
    date: formatOrderDate(node.createdAt),
    country:
      node.shippingAddress?.countryCodeV2 ||
      node.shippingAddress?.country ||
      "—",
    products: products || "—",
    revenueAmount: Number(node.totalPriceSet.shopMoney.amount),
    currencyCode: node.totalPriceSet.shopMoney.currencyCode,
  };
}

function mapCustomerNode(node: ShopifyCustomerNode): DashboardCustomer {
  return {
    id: node.id,
    email: node.email?.trim() || "",
    createdAt: node.createdAt,
    date: formatCustomerDate(node.createdAt),
    name: formatCustomerName(node.firstName, node.lastName),
  };
}

async function getShopifyAccessToken(): Promise<string> {
  if (!accessTokenPromise) {
    accessTokenPromise = (async () => {
      const shop = requireEnv(SHOP, "SHOPIFY_SHOP");
      const clientId = requireEnv(CLIENT_ID, "SHOPIFY_CLIENT_ID");
      const clientSecret = requireEnv(CLIENT_SECRET, "SHOPIFY_CLIENT_SECRET");

      const tokenUrl = `https://${shop}.myshopify.com/admin/oauth/access_token`;

      const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      });

      const response = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        cache: "no-store",
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Failed to get Shopify access token: ${text}`);
      }

      const json = (await response.json()) as { access_token?: string };

      if (!json.access_token) {
        throw new Error("Shopify did not return an access token.");
      }

      return json.access_token;
    })().catch((error) => {
      accessTokenPromise = null;
      throw error;
    });
  }

  return accessTokenPromise;
}

async function shopifyGraphQLFetch<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const shop = requireEnv(SHOP, "SHOPIFY_SHOP");
  const accessToken = await getShopifyAccessToken();

  const response = await fetch(
    `https://${shop}.myshopify.com/admin/api/2026-01/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed Shopify GraphQL request: ${text}`);
  }

  return (await response.json()) as T;
}

export async function getAllOrders(): Promise<DashboardOrder[]> {
  const query = `
    query GetOrders($first: Int!, $after: String) {
      orders(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            name
            createdAt
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            shippingAddress {
              countryCodeV2
              country
            }
            lineItems(first: 50) {
              edges {
                node {
                  title
                  quantity
                }
              }
            }
          }
        }
      }
    }
  `;

  let hasNextPage = true;
  let after: string | null = null;
  let pageCount = 0;

  const allOrders: DashboardOrder[] = [];

  while (hasNextPage && pageCount < 25) {
    const response: ShopifyOrdersResponse = await shopifyGraphQLFetch(query, {
      first: 100,
      after,
    });

    if (response.errors && response.errors.length > 0) {
      throw new Error(
        `Shopify GraphQL error: ${response.errors.map((e) => e.message).join(", ")}`
      );
    }

    const connection = response.data?.orders;

    if (!connection) {
      break;
    }

    for (const edge of connection.edges) {
      allOrders.push(mapOrderNode(edge.node));
    }

    hasNextPage = connection.pageInfo.hasNextPage;
    after = connection.pageInfo.endCursor;
    pageCount += 1;
  }

  return allOrders;
}

export async function getAllCustomers(): Promise<DashboardCustomer[]> {
  const query = `
    query GetCustomers($first: Int!, $after: String) {
      customers(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            email
            createdAt
            firstName
            lastName
          }
        }
      }
    }
  `;

  let hasNextPage = true;
  let after: string | null = null;
  let pageCount = 0;

  const allCustomers: DashboardCustomer[] = [];

  while (hasNextPage && pageCount < 25) {
    const response: ShopifyCustomersResponse = await shopifyGraphQLFetch(query, {
      first: 100,
      after,
    });

    if (response.errors && response.errors.length > 0) {
      throw new Error(
        `Shopify GraphQL error: ${response.errors.map((e) => e.message).join(", ")}`
      );
    }

    const connection = response.data?.customers;

    if (!connection) {
      break;
    }

    for (const edge of connection.edges) {
      allCustomers.push(mapCustomerNode(edge.node));
    }

    hasNextPage = connection.pageInfo.hasNextPage;
    after = connection.pageInfo.endCursor;
    pageCount += 1;
  }

  return allCustomers;
}

export async function getShopifyOrdersForDateKey(
  targetDateKey: string,
  maxPages = 5
): Promise<DashboardOrder[]> {
  const query = `
    query GetRecentOrders($first: Int!, $after: String) {
      orders(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            name
            createdAt
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            shippingAddress {
              countryCodeV2
              country
            }
            lineItems(first: 50) {
              edges {
                node {
                  title
                  quantity
                }
              }
            }
          }
        }
      }
    }
  `;

  let hasNextPage = true;
  let after: string | null = null;
  let pageCount = 0;

  const matchedOrders: DashboardOrder[] = [];

  while (hasNextPage && pageCount < maxPages) {
    const response: ShopifyOrdersResponse = await shopifyGraphQLFetch(query, {
      first: 100,
      after,
    });

    if (response.errors && response.errors.length > 0) {
      throw new Error(
        `Shopify GraphQL error: ${response.errors.map((e) => e.message).join(", ")}`
      );
    }

    const connection = response.data?.orders;

    if (!connection || connection.edges.length === 0) {
      break;
    }

    const pageOrders = connection.edges.map((edge) => mapOrderNode(edge.node));

    for (const order of pageOrders) {
      if (getDateKey(order.createdAt) === targetDateKey) {
        matchedOrders.push(order);
      }
    }

    const oldestDateKeyInPage = getDateKey(
      pageOrders[pageOrders.length - 1].createdAt
    );

    if (oldestDateKeyInPage < targetDateKey) {
      break;
    }

    hasNextPage = connection.pageInfo.hasNextPage;
    after = connection.pageInfo.endCursor;
    pageCount += 1;
  }

  return matchedOrders;
}

export async function getShopifyCustomersForDateKey(
  targetDateKey: string,
  maxPages = 5
): Promise<DashboardCustomer[]> {
  const query = `
    query GetRecentCustomers($first: Int!, $after: String) {
      customers(first: $first, after: $after, sortKey: CREATED_AT, reverse: true) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            email
            createdAt
            firstName
            lastName
          }
        }
      }
    }
  `;

  let hasNextPage = true;
  let after: string | null = null;
  let pageCount = 0;

  const matchedCustomers: DashboardCustomer[] = [];

  while (hasNextPage && pageCount < maxPages) {
    const response: ShopifyCustomersResponse = await shopifyGraphQLFetch(query, {
      first: 100,
      after,
    });

    if (response.errors && response.errors.length > 0) {
      throw new Error(
        `Shopify GraphQL error: ${response.errors.map((e) => e.message).join(", ")}`
      );
    }

    const connection = response.data?.customers;

    if (!connection || connection.edges.length === 0) {
      break;
    }

    const pageCustomers = connection.edges.map((edge) =>
      mapCustomerNode(edge.node)
    );

    for (const customer of pageCustomers) {
      if (getDateKey(customer.createdAt) === targetDateKey) {
        matchedCustomers.push(customer);
      }
    }

    const oldestDateKeyInPage = getDateKey(
      pageCustomers[pageCustomers.length - 1].createdAt
    );

    if (oldestDateKeyInPage < targetDateKey) {
      break;
    }

    hasNextPage = connection.pageInfo.hasNextPage;
    after = connection.pageInfo.endCursor;
    pageCount += 1;
  }

  return matchedCustomers;
}
export async function getTodayShopifyOrders(): Promise<DashboardOrder[]> {
  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);

  const query = `
    query GetTodayOrders($first: Int!, $after: String, $query: String!) {
      orders(first: $first, after: $after, sortKey: CREATED_AT, reverse: true, query: $query) {
        pageInfo {
          hasNextPage
          endCursor
        }
        edges {
          node {
            id
            name
            createdAt
            totalPriceSet {
              shopMoney {
                amount
                currencyCode
              }
            }
            shippingAddress {
              countryCodeV2
              country
            }
            lineItems(first: 50) {
              edges {
                node {
                  title
                  quantity
                }
              }
            }
          }
        }
      }
    }
  `;

  let hasNextPage = true;
  let after: string | null = null;
  let pageCount = 0;
  const todayOrders: DashboardOrder[] = [];

  const startIso = start.toISOString();
  const searchQuery = `created_at:>=${startIso}`;

  while (hasNextPage && pageCount < 10) {
    const response: ShopifyOrdersResponse = await shopifyGraphQLFetch(query, {
      first: 100,
      after,
      query: searchQuery,
    });

    if (response.errors && response.errors.length > 0) {
      throw new Error(
        `Shopify GraphQL error: ${response.errors.map((e) => e.message).join(", ")}`
      );
    }

    const connection = response.data?.orders;
    if (!connection) break;

    for (const edge of connection.edges) {
      const node = edge.node;

      const products = node.lineItems.edges
        .map((itemEdge) => `${itemEdge.node.title} x${itemEdge.node.quantity}`)
        .join(", ");

     todayOrders.push({
  id: node.id,
  name: node.name,
  createdAt: node.createdAt,
  date: new Date(node.createdAt).toLocaleDateString("en-GB"),
  country:
    node.shippingAddress?.countryCodeV2 ||
    node.shippingAddress?.country ||
    "—",
  products: products || "—",
  revenueAmount: Number(node.totalPriceSet.shopMoney.amount),
  currencyCode: node.totalPriceSet.shopMoney.currencyCode,
});
    }

    hasNextPage = connection.pageInfo.hasNextPage;
    after = connection.pageInfo.endCursor;
    pageCount += 1;
  }

  return todayOrders;
}