CREATE TABLE "ManualTicketSnapshot" (
    "id" TEXT NOT NULL,
    "showId" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "cumulativeTickets" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualTicketSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManualTicketSnapshot_showId_snapshotDate_key"
ON "ManualTicketSnapshot"("showId", "snapshotDate");

CREATE INDEX "ManualTicketSnapshot_showId_snapshotDate_idx"
ON "ManualTicketSnapshot"("showId", "snapshotDate");

ALTER TABLE "ManualTicketSnapshot"
ADD CONSTRAINT "ManualTicketSnapshot_showId_fkey"
FOREIGN KEY ("showId") REFERENCES "Show"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ManualTicketSnapshot" (
    "id",
    "showId",
    "snapshotDate",
    "cumulativeTickets",
    "createdAt",
    "updatedAt"
)
SELECT
    'nijmegen-snapshot-' || snapshot_data.snapshot_date,
    show_record."id",
    snapshot_data.snapshot_date::date,
    snapshot_data.cumulative_tickets,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Show" AS show_record
CROSS JOIN (
    VALUES
        ('2026-06-22', 36),
        ('2026-06-29', 56),
        ('2026-07-06', 74),
        ('2026-07-13', 90)
) AS snapshot_data(snapshot_date, cumulative_tickets)
WHERE show_record."slug" = 'nijmegen-2026'
ON CONFLICT ("showId", "snapshotDate") DO UPDATE
SET
    "cumulativeTickets" = EXCLUDED."cumulativeTickets",
    "updatedAt" = CURRENT_TIMESTAMP;

UPDATE "Show"
SET "ticketSales" = 90
WHERE "slug" = 'nijmegen-2026';
