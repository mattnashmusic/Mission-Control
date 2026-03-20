export function getBaseShippingCost(country: string): number {
  switch (country) {
    case "NL":
      return 2.8;
    case "DE":
      return 3.75;
    case "BE":
      return 4.8;
    case "FR":
      return 3.9;
    case "LU":
      return 4.3;
    case "CH":
      return 4.95;
    case "GB":
      return 3.8;
    default:
      return 5.5;
  }
}

export function calculateShippingCost(
  country: string,
  products: string
): number {
  const base = getBaseShippingCost(country);
  const normalizedProducts = products.toLowerCase();

  const hasVinyl = normalizedProducts.includes("rebirth vinyl");

  if (hasVinyl) {
    return base * 2;
  }

  return base;
}