-- AlterTable
ALTER TABLE "events" ADD COLUMN     "entryPasses" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "media_rooms" ALTER COLUMN "galleryVisibility" SET DEFAULT 'PUBLIC',
ALTER COLUMN "uploadsEnabled" SET DEFAULT false,
ALTER COLUMN "downloadPolicy" SET DEFAULT '{"guestsCanDownload":true,"originalQuality":false}';

-- Existing albums take the new privacy defaults (the hidden design-photos album keeps its own settings):
-- nobody uploads with the album link alone (the host can let invited guests upload again),
-- and the gallery the album link and the wall's QR code open is public, with downloads.
UPDATE "media_rooms" SET "uploadsEnabled" = false WHERE "slug" <> 'design-photos';
UPDATE "media_rooms" SET "galleryVisibility" = 'PUBLIC' WHERE "galleryVisibility" = 'INVITE_ONLY' AND "slug" <> 'design-photos';
UPDATE "media_rooms" SET "downloadPolicy" = jsonb_set(COALESCE("downloadPolicy", '{}'::jsonb), '{guestsCanDownload}', 'true'::jsonb) WHERE "slug" <> 'design-photos';
