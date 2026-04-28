CREATE TABLE IF NOT EXISTS "TourVote" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "selectedCity" TEXT NOT NULL,
  "selectedCountry" TEXT NOT NULL,
  "inferredCity" TEXT,
  "inferredCountry" TEXT,
  "source" TEXT DEFAULT 'tourvote',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TourVote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TourVote_createdAt_idx"
  ON "TourVote"("createdAt");

CREATE INDEX IF NOT EXISTS "TourVote_selectedCity_idx"
  ON "TourVote"("selectedCity");

CREATE INDEX IF NOT EXISTS "TourVote_selectedCountry_idx"
  ON "TourVote"("selectedCountry");