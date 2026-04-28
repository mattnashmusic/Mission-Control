CREATE TABLE IF NOT EXISTS "ShippingCostEntry" (
  "id" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "countryName" TEXT NOT NULL,
  "cd1OnlyCost" DOUBLE PRECISION,
  "cdPackageCost" DOUBLE PRECISION NOT NULL,
  "vinylCost" DOUBLE PRECISION NOT NULL,
  "vinylIncludesCds" BOOLEAN NOT NULL DEFAULT false,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShippingCostEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ShippingCostEntry_countryCode_idx" ON "ShippingCostEntry"("countryCode");
CREATE INDEX IF NOT EXISTS "ShippingCostEntry_effectiveFrom_idx" ON "ShippingCostEntry"("effectiveFrom");
