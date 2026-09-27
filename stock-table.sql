CREATE TABLE IF NOT EXISTS "StockCountEntry" (
  "id" TEXT NOT NULL,
  "itemKey" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "countedAt" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockCountEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StockCountEntry_itemKey_idx" ON "StockCountEntry"("itemKey");
CREATE INDEX IF NOT EXISTS "StockCountEntry_countedAt_idx" ON "StockCountEntry"("countedAt");

CREATE TABLE IF NOT EXISTS "ReorderSetting" (
  "itemKey" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  "productionDays" INTEGER NOT NULL DEFAULT 14,
  "shippingDays" INTEGER NOT NULL DEFAULT 7,
  "bufferDays" INTEGER NOT NULL DEFAULT 14,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReorderSetting_pkey" PRIMARY KEY ("itemKey")
);
