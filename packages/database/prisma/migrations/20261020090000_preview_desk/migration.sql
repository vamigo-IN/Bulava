-- CreateEnum
CREATE TYPE "PreviewRequestStatus" AS ENUM ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'SENT', 'CHANGES_REQUESTED', 'OWNED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PreviewKind" AS ENUM ('WEBSITE', 'CARD', 'FILM');

-- CreateEnum
CREATE TYPE "PreviewItemStatus" AS ENUM ('DRAFT', 'SHARED', 'WITHDRAWN');

-- AlterEnum
ALTER TYPE "PlatformRole" ADD VALUE 'PREVIEW_PROVIDER';

-- AlterTable
ALTER TABLE "consents" ADD COLUMN     "previewRequestId" UUID;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "previewRequestId" UUID;

-- AlterTable
ALTER TABLE "card_sessions" ADD COLUMN     "tokenCiphertext" TEXT;

-- AlterTable
ALTER TABLE "card_orders" ADD COLUMN     "previewRequestId" UUID;

-- CreateTable
CREATE TABLE "preview_requests" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "PreviewRequestStatus" NOT NULL DEFAULT 'NEW',
    "source" TEXT NOT NULL DEFAULT 'WEBSITE',
    "tokenHash" TEXT NOT NULL,
    "linkVersion" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" CITEXT,
    "userId" UUID,
    "eventTypeKey" TEXT NOT NULL,
    "title" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "date" TEXT,
    "venue" TEXT,
    "city" TEXT,
    "functions" JSONB NOT NULL DEFAULT '[]',
    "wants" "PreviewKind"[],
    "templateKey" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "notes" TEXT,
    "assigneeId" UUID,
    "assignedAt" TIMESTAMP(3),
    "offerPlanKey" TEXT,
    "offerCouponCode" TEXT,
    "sentAt" TIMESTAMP(3),
    "firstViewedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "views" INTEGER NOT NULL DEFAULT 0,
    "ownedAt" TIMESTAMP(3),
    "ownerId" UUID,
    "orderId" UUID,
    "cardOrderId" UUID,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preview_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preview_items" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "kind" "PreviewKind" NOT NULL,
    "status" "PreviewItemStatus" NOT NULL DEFAULT 'DRAFT',
    "templateKey" TEXT NOT NULL,
    "eventId" UUID,
    "cardSessionId" UUID,
    "sharedAt" TIMESTAMP(3),
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "preview_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preview_activities" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "actorId" UUID,
    "kind" TEXT NOT NULL,
    "text" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "preview_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "preview_requests_reference_key" ON "preview_requests"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "preview_requests_tokenHash_key" ON "preview_requests"("tokenHash");

-- CreateIndex
CREATE INDEX "preview_requests_status_createdAt_idx" ON "preview_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "preview_requests_assigneeId_status_idx" ON "preview_requests"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "preview_requests_phone_idx" ON "preview_requests"("phone");

-- CreateIndex
CREATE INDEX "preview_requests_userId_idx" ON "preview_requests"("userId");

-- CreateIndex
CREATE INDEX "preview_items_requestId_idx" ON "preview_items"("requestId");

-- CreateIndex
CREATE INDEX "preview_items_eventId_idx" ON "preview_items"("eventId");

-- CreateIndex
CREATE INDEX "preview_items_cardSessionId_idx" ON "preview_items"("cardSessionId");

-- CreateIndex
CREATE INDEX "preview_activities_requestId_createdAt_idx" ON "preview_activities"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "consents_previewRequestId_idx" ON "consents"("previewRequestId");

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_previewRequestId_fkey" FOREIGN KEY ("previewRequestId") REFERENCES "preview_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preview_requests" ADD CONSTRAINT "preview_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preview_requests" ADD CONSTRAINT "preview_requests_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preview_items" ADD CONSTRAINT "preview_items_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "preview_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preview_items" ADD CONSTRAINT "preview_items_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preview_items" ADD CONSTRAINT "preview_items_cardSessionId_fkey" FOREIGN KEY ("cardSessionId") REFERENCES "card_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preview_activities" ADD CONSTRAINT "preview_activities_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "preview_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

