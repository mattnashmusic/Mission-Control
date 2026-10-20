-- AlterTable: optional hand-drawn include/exclude areas and per-city toggles
-- layered on top of a saved radius audience.
ALTER TABLE "SavedAudience" ADD COLUMN "refinements" JSONB;
