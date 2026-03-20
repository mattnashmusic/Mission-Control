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
  shippingAddress: {
    countryCodeV2?: string;
    country?: string;
  } | null;
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

function requireEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-GB");
}

function formatCustomerName(
  firstName: string | null,
  lastName: string | null
): string {
  const name = [firstName ?? "", lastName ?? ""].join(" ").trim();
  return name || "—";
}

async function getShopifyAccessToken(): Promise<string> {
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
    const response: ShopifyOrdersResponse =
      await shopifyGraphQLFetch<ShopifyOrdersResponse>(query, {
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
      const node = edge.node;

      const products = node.lineItems.edges
        .map((itemEdge) => `${itemEdge.node.title} x${itemEdge.node.quantity}`)
        .join(", ");

      allOrders.push({
        id: node.id,
        name: node.name,
        createdAt: node.createdAt,
        date: formatDate(node.createdAt),
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
    const response: ShopifyCustomersResponse =
      await shopifyGraphQLFetch<ShopifyCustomersResponse>(query, {
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
      const node = edge.node;

      allCustomers.push({
        id: node.id,
        email: node.email?.trim() || "",
        createdAt: node.createdAt,
        date: formatDate(node.createdAt),
        name: formatCustomerName(node.firstName, node.lastName),
      });
    }

    hasNextPage = connection.pageInfo.hasNextPage;
    after = connection.pageInfo.endCursor;
    pageCount += 1;
  }

  return allCustomers;
}