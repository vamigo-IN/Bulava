-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "creditMinor" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "pricing_plans" ADD COLUMN     "badge" TEXT,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'PLAN',
ADD COLUMN     "offeredTo" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "stackable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tagline" TEXT,
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'PUBLIC';

-- CreateTable
CREATE TABLE "event_slug_aliases" (
    "slug" TEXT NOT NULL,
    "eventId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_slug_aliases_pkey" PRIMARY KEY ("slug")
);

-- CreateIndex
CREATE INDEX "event_slug_aliases_eventId_idx" ON "event_slug_aliases"("eventId");

-- AddForeignKey
ALTER TABLE "event_slug_aliases" ADD CONSTRAINT "event_slug_aliases_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ───────────── One-time plans and add-ons (ADR-062) ─────────────
-- What is sold: a plan (the account's tier) or an add-on (one thing more, on top of a plan).
ALTER TABLE "pricing_plans" ADD CONSTRAINT "pricing_plans_kind_check" CHECK ("kind" IN ('PLAN', 'ADDON'));
ALTER TABLE "pricing_plans" ADD CONSTRAINT "pricing_plans_visibility_check" CHECK ("visibility" IN ('PUBLIC', 'HIDDEN'));
ALTER TABLE "orders" ADD CONSTRAINT "orders_quantity_check" CHECK ("quantity" BETWEEN 1 AND 50);
ALTER TABLE "orders" ADD CONSTRAINT "orders_credit_check" CHECK ("creditMinor" >= 0);

-- The plans already in a database move to the new one-time tiers. Customers keep what they bought:
-- their entitlements are copies of their plan as it was. On a new database the seed makes these rows
-- (and the new tiers and add-ons) from packages/database/src/seed-data.ts, so both end alike.

-- Free: design and preview as much as you like; publishing and downloads need a plan. RSVP and music
-- stay on in the baseline, so events published for free before keep working as they did.
UPDATE "pricing_plans" SET "description" = 'Design and preview your invitation, video and cards as much as you like. Choose a plan to publish and download.' WHERE "key" = 'FREE';
UPDATE "plan_features" SET "limit" = 0 WHERE "featureKey" = 'events.max' AND "planId" IN (SELECT "id" FROM "pricing_plans" WHERE "key" = 'FREE');
UPDATE "plan_features" SET "enabled" = false, "limit" = 0 WHERE "featureKey" = 'video.renders.max' AND "planId" IN (SELECT "id" FROM "pricing_plans" WHERE "key" = 'FREE');
INSERT INTO "plan_features" ("id", "planId", "featureKey", "enabled", "limit")
SELECT gen_random_uuid(), p."id", f.key, f.enabled, f.lim
FROM "pricing_plans" p, (VALUES ('rsvp.enabled', true, NULL::integer), ('music.enabled', true, NULL), ('link.custom', false, NULL)) AS f(key, enabled, lim)
WHERE p."key" = 'FREE'
ON CONFLICT ("planId", "featureKey") DO NOTHING;

-- Standard: ₹599, proper guest management.
UPDATE "pricing_plans"
SET "priceMinor" = 59900, "name" = 'Standard', "tagline" = 'Guest RSVP', "badge" = NULL, "sortOrder" = 3,
    "description" = 'Up to 8 functions and 500 guests, RSVP for each function, no branding.'
WHERE "key" = 'STANDARD';
DELETE FROM "plan_features" WHERE "planId" IN (SELECT "id" FROM "pricing_plans" WHERE "key" = 'STANDARD');
INSERT INTO "plan_features" ("id", "planId", "featureKey", "enabled", "limit")
SELECT gen_random_uuid(), p."id", f.key, f.enabled, f.lim
FROM "pricing_plans" p, (VALUES
  ('events.max', true, 1::integer), ('functions.max', true, 8), ('guests.max', true, 500), ('templates.maxTier', true, 1),
  ('media.photos.max', true, 500), ('video.renders.max', false, 0), ('video.hd', false, NULL), ('branding.watermark', false, NULL),
  ('domain.custom', false, NULL), ('messaging.whatsapp.max', true, 300), ('rsvp.enabled', true, NULL), ('music.enabled', false, NULL),
  ('link.custom', false, NULL)
) AS f(key, enabled, lim)
WHERE p."key" = 'STANDARD';

-- Premium: ₹999, the first with the MP4 video; the one to push.
UPDATE "pricing_plans"
SET "priceMinor" = 99900, "name" = 'Premium', "tagline" = '+ MP4 video', "badge" = 'Most popular', "sortOrder" = 4,
    "description" = 'The shareable MP4 video, premium designs, your own link and music, 12 functions and 1,000 guests.'
WHERE "key" = 'PREMIUM';
DELETE FROM "plan_features" WHERE "planId" IN (SELECT "id" FROM "pricing_plans" WHERE "key" = 'PREMIUM');
INSERT INTO "plan_features" ("id", "planId", "featureKey", "enabled", "limit")
SELECT gen_random_uuid(), p."id", f.key, f.enabled, f.lim
FROM "pricing_plans" p, (VALUES
  ('events.max', true, 1::integer), ('functions.max', true, 12), ('guests.max', true, 1000), ('templates.maxTier', true, 2),
  ('media.photos.max', true, 1000), ('video.renders.max', true, 5), ('video.hd', true, NULL), ('branding.watermark', false, NULL),
  ('domain.custom', true, NULL), ('messaging.whatsapp.max', true, 700), ('rsvp.enabled', true, NULL), ('music.enabled', true, NULL),
  ('link.custom', true, NULL)
) AS f(key, enabled, lim)
WHERE p."key" = 'PREMIUM';

-- Studio (planners) leaves the plans page, so nothing there runs for a year; its holders keep it.
UPDATE "pricing_plans" SET "visibility" = 'HIDDEN', "sortOrder" = 9 WHERE "key" = 'STUDIO';
