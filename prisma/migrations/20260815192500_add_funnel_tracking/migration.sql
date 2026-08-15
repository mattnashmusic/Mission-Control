-- CreateTable
CREATE TABLE "ReleasePage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReleasePage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReleasePage_slug_key" ON "ReleasePage"("slug");

-- CreateTable
CREATE TABLE "FunnelPageEvent" (
    "id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "pageSlug" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FunnelPageEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FunnelPageEvent_section_pageSlug_eventType_createdAt_idx" ON "FunnelPageEvent"("section", "pageSlug", "eventType", "createdAt");

-- Enable Row Level Security on the new tables and allow public read access
-- (writes only ever happen server-side via the Prisma connection, which
-- connects with full DB credentials and is unaffected by RLS).
ALTER TABLE "ReleasePage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FunnelPageEvent" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON "ReleasePage"
    FOR SELECT USING (true);

CREATE POLICY "Public read access" ON "FunnelPageEvent"
    FOR SELECT USING (true);

-- Seed the first release page
INSERT INTO "ReleasePage" ("id", "slug", "name", "path", "active", "createdAt", "updatedAt")
VALUES ('release-falling', 'falling', 'Falling', '/pages/falling', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;
