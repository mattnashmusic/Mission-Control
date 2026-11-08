-- CreateTable: Rebirth Tour Part 2 city registration signups (separate from TourVote)
CREATE TABLE "TourRegistration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "inferredCity" TEXT,
    "inferredCountry" TEXT,
    "eventId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "pageUrl" TEXT,
    "referrer" TEXT,
    "mailerliteStatus" TEXT,
    "mailerliteError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TourRegistration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TourRegistration_createdAt_idx" ON "TourRegistration"("createdAt");
CREATE INDEX "TourRegistration_source_idx" ON "TourRegistration"("source");
CREATE INDEX "TourRegistration_email_idx" ON "TourRegistration"("email");

ALTER TABLE "TourRegistration" ENABLE ROW LEVEL SECURITY;
