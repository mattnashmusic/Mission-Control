-- CreateTable
CREATE TABLE "ShowMetaAdSet" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "adSetId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShowMetaAdSet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShowMetaAdSet_showId_adSetId_key" ON "ShowMetaAdSet"("showId", "adSetId");

-- CreateIndex
CREATE INDEX "ShowMetaAdSet_showId_idx" ON "ShowMetaAdSet"("showId");

-- AddForeignKey
ALTER TABLE "ShowMetaAdSet" ADD CONSTRAINT "ShowMetaAdSet_showId_fkey" FOREIGN KEY ("showId") REFERENCES "Show"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: preserve the show -> ad set mapping that previously lived hardcoded
-- in lib/tour-show-meta-campaigns.ts, now that it's DB-driven.
INSERT INTO "ShowMetaAdSet" ("id", "showId", "adSetId", "label")
SELECT 'seed-hamburg-2026-base', "id", '120246196697620724', 'Base' FROM "Show" WHERE "slug" = 'hamburg-2026'
UNION ALL
SELECT 'seed-berlin-2026-base', "id", '120246265623870724', 'Base' FROM "Show" WHERE "slug" = 'berlin-2026'
UNION ALL
SELECT 'seed-munich-2026-base', "id", '120246265801060724', 'Base' FROM "Show" WHERE "slug" = 'munich-2026'
UNION ALL
SELECT 'seed-zurich-2026-base', "id", '120246265869510724', 'Base' FROM "Show" WHERE "slug" = 'zurich-2026'
UNION ALL
SELECT 'seed-cologne-2026-base', "id", '120246266127070724', 'Base' FROM "Show" WHERE "slug" = 'cologne-2026'
UNION ALL
SELECT 'seed-brussels-2026-base', "id", '120246266391840724', 'Base' FROM "Show" WHERE "slug" = 'brussels-2026'
UNION ALL
SELECT 'seed-nijmegen-2026-base', "id", '120246266509220724', 'Base' FROM "Show" WHERE "slug" = 'nijmegen-2026'
UNION ALL
SELECT 'seed-amsterdam-2026-base', "id", '120246266571770724', 'Base' FROM "Show" WHERE "slug" = 'amsterdam-2026'
ON CONFLICT DO NOTHING;
