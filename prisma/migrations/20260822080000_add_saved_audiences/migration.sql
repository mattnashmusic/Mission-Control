-- CreateTable
CREATE TABLE "SavedAudience" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "radiusKm" INTEGER NOT NULL,
    "showId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedAudience_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SavedAudience_createdAt_idx" ON "SavedAudience"("createdAt");

-- Enable Row Level Security and allow public read access, matching the
-- other app-managed tables. Writes only ever happen server-side via the
-- Prisma connection, which is unaffected by RLS.
ALTER TABLE "SavedAudience" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON "SavedAudience"
    FOR SELECT USING (true);
