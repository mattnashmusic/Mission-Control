export type ProductItemKey = "cd1" | "cd2" | "vinyl";

export const PRODUCT_ITEMS: Array<{ itemKey: ProductItemKey; itemName: string }> = [
  { itemKey: "cd1", itemName: "CD1" },
  { itemKey: "cd2", itemName: "CD2" },
  { itemKey: "vinyl", itemName: "Vinyl" },
];

export function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/["']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Maps a Shopify line-item title to a physical product bucket, regardless of
 * which listing it came from (the "funnel" products like "Rebirth CD DELUXE"
 * or the "[Signed]" store products like "Rebirth CD DELUXE [Signed]" both
 * resolve to the same itemKey, since they draw from the same physical stock).
 */
export function getProductItemKey(productName: string): ProductItemKey | null {
  const name = normalizeText(productName);

  if (
    name.includes("rebirth cd deluxe") ||
    name.includes("cd deluxe") ||
    name.includes("deluxe cd")
  ) {
    return "cd2";
  }

  if (name.includes("rebirth vinyl") || name.includes("vinyl")) {
    return "vinyl";
  }

  if (name.includes("rebirth cd") || name.includes("cd")) {
    return "cd1";
  }

  return null;
}
