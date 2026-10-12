-- AlterTable
ALTER TABLE "events" ADD COLUMN     "rsvpEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "pricing_plans" ADD COLUMN     "listPriceMinor" INTEGER;


-- ───────────── Plans redesigned: Free and four paid plans, offer prices (ADR-067) ─────────────
-- An offer price is never above the usual price it is shown against.
ALTER TABLE "pricing_plans" ADD CONSTRAINT "pricing_plans_list_price_check" CHECK ("listPriceMinor" IS NULL OR "listPriceMinor" >= "priceMinor");

-- The plans already in a database move to the new matrix. Customers keep what they bought: their
-- entitlements are copies of their plan as it was (and are completed below). On a new database the
-- seed makes these rows from packages/database/src/seed-data.ts, so both end alike.
CREATE TEMP TABLE "_plan_matrix" ("key" TEXT, "featureKey" TEXT, "enabled" BOOLEAN, "lim" INTEGER);
INSERT INTO "_plan_matrix" VALUES
  -- Free: one event with one function, on free designs, with Bulava's mark across it; nothing else.
  ('FREE', 'events.max', true, 1), ('FREE', 'functions.max', true, 1), ('FREE', 'guests.max', true, 50),
  ('FREE', 'templates.maxTier', true, 0), ('FREE', 'media.photos.max', true, 0), ('FREE', 'video.renders.max', false, 0),
  ('FREE', 'video.hd', false, NULL), ('FREE', 'branding.watermark', true, NULL), ('FREE', 'domain.custom', false, NULL),
  ('FREE', 'messaging.whatsapp.max', false, 0), ('FREE', 'rsvp.enabled', false, NULL), ('FREE', 'music.enabled', false, NULL),
  ('FREE', 'link.custom', false, NULL), ('FREE', 'gallery.enabled', false, NULL), ('FREE', 'cards.included', false, 0),
  -- Starter: no mark, replies, a 50-photo gallery.
  ('STARTER', 'events.max', true, 1), ('STARTER', 'functions.max', true, 1), ('STARTER', 'guests.max', true, 150),
  ('STARTER', 'templates.maxTier', true, 1), ('STARTER', 'media.photos.max', true, 50), ('STARTER', 'video.renders.max', false, 0),
  ('STARTER', 'video.hd', false, NULL), ('STARTER', 'branding.watermark', false, NULL), ('STARTER', 'domain.custom', false, NULL),
  ('STARTER', 'messaging.whatsapp.max', false, 0), ('STARTER', 'rsvp.enabled', true, NULL), ('STARTER', 'music.enabled', false, NULL),
  ('STARTER', 'link.custom', false, NULL), ('STARTER', 'gallery.enabled', true, NULL), ('STARTER', 'cards.included', false, 0),
  -- Standard: WhatsApp invitations and RSVP updates, music, five watermark-free cards.
  ('STANDARD', 'events.max', true, 1), ('STANDARD', 'functions.max', true, 4), ('STANDARD', 'guests.max', true, 400),
  ('STANDARD', 'templates.maxTier', true, 1), ('STANDARD', 'media.photos.max', true, 250), ('STANDARD', 'video.renders.max', false, 0),
  ('STANDARD', 'video.hd', false, NULL), ('STANDARD', 'branding.watermark', false, NULL), ('STANDARD', 'domain.custom', false, NULL),
  ('STANDARD', 'messaging.whatsapp.max', true, 300), ('STANDARD', 'rsvp.enabled', true, NULL), ('STANDARD', 'music.enabled', true, NULL),
  ('STANDARD', 'link.custom', false, NULL), ('STANDARD', 'gallery.enabled', true, NULL), ('STANDARD', 'cards.included', true, 5),
  -- Premium: Signature designs, the MP4 video, the owner's own link and domain.
  ('PREMIUM', 'events.max', true, 1), ('PREMIUM', 'functions.max', true, 8), ('PREMIUM', 'guests.max', true, 1000),
  ('PREMIUM', 'templates.maxTier', true, 2), ('PREMIUM', 'media.photos.max', true, 1000), ('PREMIUM', 'video.renders.max', true, 5),
  ('PREMIUM', 'video.hd', true, NULL), ('PREMIUM', 'branding.watermark', false, NULL), ('PREMIUM', 'domain.custom', true, NULL),
  ('PREMIUM', 'messaging.whatsapp.max', true, 700), ('PREMIUM', 'rsvp.enabled', true, NULL), ('PREMIUM', 'music.enabled', true, NULL),
  ('PREMIUM', 'link.custom', true, NULL), ('PREMIUM', 'gallery.enabled', true, NULL), ('PREMIUM', 'cards.included', true, 10),
  -- Ultimate: everything, unlimited functions and guests.
  ('ULTIMATE', 'events.max', true, 1), ('ULTIMATE', 'functions.max', true, NULL), ('ULTIMATE', 'guests.max', true, NULL),
  ('ULTIMATE', 'templates.maxTier', true, 2), ('ULTIMATE', 'media.photos.max', true, 5000), ('ULTIMATE', 'video.renders.max', true, 10),
  ('ULTIMATE', 'video.hd', true, NULL), ('ULTIMATE', 'branding.watermark', false, NULL), ('ULTIMATE', 'domain.custom', true, NULL),
  ('ULTIMATE', 'messaging.whatsapp.max', true, 1500), ('ULTIMATE', 'rsvp.enabled', true, NULL), ('ULTIMATE', 'music.enabled', true, NULL),
  ('ULTIMATE', 'link.custom', true, NULL), ('ULTIMATE', 'gallery.enabled', true, NULL), ('ULTIMATE', 'cards.included', true, 20),
  ('ULTIMATE', 'support.priority', true, NULL);

UPDATE "pricing_plans" SET "listPriceMinor" = NULL, "badge" = NULL, "tagline" = NULL, "sortOrder" = 0, "active" = true, "visibility" = 'PUBLIC',
  "description" = 'One event with one function on a free design, with the Bulava mark across it. Design and preview anything you like.'
WHERE "key" = 'FREE';
UPDATE "pricing_plans" SET "priceMinor" = 29900, "listPriceMinor" = 59900, "badge" = NULL, "tagline" = 'No branding', "sortOrder" = 1, "active" = true, "visibility" = 'PUBLIC',
  "description" = 'Your invitation without the Bulava mark, on Premium designs: one function, RSVP for 150 guests and a 50-photo gallery.'
WHERE "key" = 'STARTER';
UPDATE "pricing_plans" SET "priceMinor" = 59900, "listPriceMinor" = 119900, "badge" = NULL, "tagline" = 'RSVP on WhatsApp', "sortOrder" = 2, "active" = true, "visibility" = 'PUBLIC',
  "description" = 'Up to 4 functions and 400 guests, invitations and RSVP updates on WhatsApp, music, a 250-photo gallery and 5 watermark-free cards.'
WHERE "key" = 'STANDARD';
UPDATE "pricing_plans" SET "priceMinor" = 99900, "listPriceMinor" = 199900, "badge" = 'Most popular', "tagline" = '+ MP4 video', "sortOrder" = 3, "active" = true, "visibility" = 'PUBLIC',
  "description" = 'Signature designs, the MP4 video, your own link, 8 functions, 1,000 guests, a 1,000-photo gallery and 10 watermark-free cards.'
WHERE "key" = 'PREMIUM';
UPDATE "pricing_plans" SET "priceMinor" = 199900, "listPriceMinor" = 399900, "badge" = NULL, "tagline" = 'Everything, unlimited', "sortOrder" = 4, "active" = true, "visibility" = 'PUBLIC',
  "description" = 'Everything for one big celebration: unlimited functions and guests, every design, 10 videos, a 5,000-photo gallery and 20 watermark-free cards.'
WHERE "key" = 'ULTIMATE';

DELETE FROM "plan_features" WHERE "planId" IN (SELECT "id" FROM "pricing_plans" WHERE "key" IN ('FREE', 'STARTER', 'STANDARD', 'PREMIUM', 'ULTIMATE'));
INSERT INTO "plan_features" ("id", "planId", "featureKey", "enabled", "limit")
SELECT gen_random_uuid(), p."id", m."featureKey", m."enabled", m."lim"
FROM "_plan_matrix" m JOIN "pricing_plans" p ON p."key" = m."key";

-- Four paid plans only: the hidden low plan, the done-for-you plan and the yearly planner plan are no longer
-- sold (their holders keep them), nor the add-on that only the hidden plan needed.
UPDATE "pricing_plans" SET "active" = false WHERE "key" IN ('LITE', 'GRAND', 'STUDIO', 'ADDON_NO_MARK');
UPDATE "pricing_plans" SET "offeredTo" = ARRAY['STARTER', 'STANDARD'] WHERE "key" = 'ADDON_VIDEO';
UPDATE "pricing_plans" SET "offeredTo" = ARRAY['STARTER', 'STANDARD', 'PREMIUM'] WHERE "key" = 'ADDON_FUNCTION';
UPDATE "pricing_plans" SET "offeredTo" = ARRAY['STARTER', 'STANDARD', 'PREMIUM', 'ULTIMATE'] WHERE "key" = 'ADDON_DONE_FOR_YOU';

-- Customers keep what they had. Their plan entitlements (copies made when they bought or were given a plan)
-- may predate a feature that the free baseline now switches off (replies, music) or that is new (the gallery,
-- watermark-free cards): each plan of theirs gets the missing ones, valid as long as the plan.
CREATE TEMP TABLE "_held" AS
SELECT DISTINCT ON (e."sourceId") e."sourceId", e."userId", e."eventId", e."validFrom", e."validUntil", p."key" AS "planKey"
FROM "entitlements" e
JOIN "orders" o ON o."id"::text = e."sourceId"
JOIN "pricing_plans" p ON p."id" = o."planId"
WHERE e."sourceType" = 'ORDER' AND p."kind" = 'PLAN' AND p."key" <> 'FREE'
ORDER BY e."sourceId", e."createdAt";

INSERT INTO "entitlements" ("id", "userId", "eventId", "featureKey", "enabled", "limit", "sourceType", "sourceId", "validFrom", "validUntil")
SELECT gen_random_uuid(), h."userId", h."eventId", f."featureKey", f."enabled", f."lim", 'ORDER', h."sourceId", h."validFrom", h."validUntil"
FROM "_held" h
CROSS JOIN LATERAL (
  VALUES
    ('rsvp.enabled', true, NULL::integer),
    ('music.enabled', true, NULL::integer),
    ('gallery.enabled', true, NULL::integer),
    ('cards.included', h."planKey" NOT IN ('LITE', 'STARTER'),
      CASE h."planKey" WHEN 'LITE' THEN 0 WHEN 'STARTER' THEN 0 WHEN 'STANDARD' THEN 5 WHEN 'PREMIUM' THEN 10 ELSE 20 END)
) AS f("featureKey", "enabled", "lim")
WHERE NOT EXISTS (
  SELECT 1 FROM "entitlements" x WHERE x."sourceType" = 'ORDER' AND x."sourceId" = h."sourceId" AND x."featureKey" = f."featureKey"
);

DROP TABLE "_held";
DROP TABLE "_plan_matrix";
