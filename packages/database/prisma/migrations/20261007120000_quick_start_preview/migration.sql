-- AlterTable
ALTER TABLE "users" ADD COLUMN     "provisional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappOptInAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "previewToken" TEXT,
ADD COLUMN     "source" TEXT;

-- Every existing event gets an unguessable preview link too (a random UUID, 122 random bits, as hex).
UPDATE "events" SET "previewToken" = replace(gen_random_uuid()::text, '-', '') WHERE "previewToken" IS NULL;
ALTER TABLE "events" ALTER COLUMN "previewToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "events_previewToken_key" ON "events"("previewToken");
