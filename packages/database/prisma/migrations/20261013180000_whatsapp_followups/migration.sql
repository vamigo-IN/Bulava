-- AlterTable
ALTER TABLE "media_rooms" ADD COLUMN     "autoShareGallery" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "galleryAutoSharedAt" TIMESTAMP(3),
ADD COLUMN     "gallerySharedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "providerMessageId" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "failedNoticeAt" TIMESTAMP(3),
ADD COLUMN     "pendingNoticeAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "whatsapp_numbers" (
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REACHABLE',
    "reason" TEXT,
    "failures" INTEGER NOT NULL DEFAULT 0,
    "lastFailureAt" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_numbers_pkey" PRIMARY KEY ("phone")
);

-- CreateIndex
CREATE INDEX "whatsapp_numbers_status_idx" ON "whatsapp_numbers"("status");

-- CreateIndex
CREATE INDEX "notifications_providerMessageId_idx" ON "notifications"("providerMessageId");


-- Hand-written: the statuses a number can be in (ADR-073).
ALTER TABLE "whatsapp_numbers" ADD CONSTRAINT "whatsapp_numbers_status_check" CHECK ("status" IN ('REACHABLE', 'UNREACHABLE', 'OPTED_OUT'));
