function getUnitCost(productName: string): number {
  const name = productName.toLowerCase().trim();

  if (
    name.includes("rebirth cd deluxe") ||
    name.includes("cd deluxe") ||
    name.includes("deluxe cd")
  ) {
    return 2.2;
  }

  if (
    name.includes("rebirth vinyl") ||
    name.includes("vinyl")
  ) {
    return 6.5;
  }

  if (
    name.includes("rebirth cd") ||
    name.includes("cd")
  ) {
    return 1.04;
  }

  return 0;
}

export function getProductCost(productsSummary: string): number {
  if (!productsSummary) return 0;

  return productsSummary
    .split(",")
    .map((part) => part.trim())
    .reduce((sum, item) => {
      const match = item.match(/(.+?) x(\d+)$/i);
      const productName = match ? match[1].trim() : item;
      const quantity = match ? Number(match[2]) : 1;

      return sum + getUnitCost(productName) * quantity;
    }, 0);
}