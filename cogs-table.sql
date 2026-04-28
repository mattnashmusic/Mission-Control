CREATE TABLE IF NOT EXISTS "CogsCostEntry" (
  "id" TEXT NOT NULL,
  "itemKey" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "unitCost" DOUBLE PRECISION NOT NULL,
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CogsCostEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CogsCostEntry_itemKey_idx" ON "CogsCostEntry"("itemKey");
CREATE INDEX IF NOT EXISTS "CogsCostEntry_category_idx" ON "CogsCostEntry"("category");
CREATE INDEX IF NOT EXISTS "CogsCostEntry_effectiveFrom_idx" ON "CogsCostEntry"("effectiveFrom");
