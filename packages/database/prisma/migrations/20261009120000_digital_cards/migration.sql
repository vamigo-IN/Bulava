-- CreateEnum
CREATE TYPE "CardOrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "CardExportKind" AS ENUM ('FREE', 'PAID', 'PLAN');

-- CreateEnum
CREATE TYPE "CardExportStatus" AS ENUM ('QUEUED', 'RENDERING', 'READY', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CardEmailStatus" AS ENUM ('NONE', 'QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "CardUploadStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'REJECTED');

-- AlterTable
ALTER TABLE "consents" ADD COLUMN     "cardLeadId" UUID;

-- CreateTable
CREATE TABLE "card_sessions" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "templateVersionId" UUID,
    "eventType" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "design" JSONB NOT NULL,
    "designHash" TEXT NOT NULL,
    "userId" UUID,
    "leadId" UUID,
    "customizedAt" TIMESTAMP(3),
    "downloadOpenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_leads" (
    "id" UUID NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "nationalNumber" TEXT NOT NULL,
    "name" TEXT,
    "email" CITEXT,
    "marketingConsentAt" TIMESTAMP(3),
    "marketingWithdrawnAt" TIMESTAMP(3),
    "lastChoice" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_orders" (
    "id" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "sessionId" UUID,
    "leadId" UUID NOT NULL,
    "userId" UUID,
    "status" "CardOrderStatus" NOT NULL DEFAULT 'PENDING',
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "provider" TEXT NOT NULL DEFAULT 'RAZORPAY',
    "providerOrderId" TEXT,
    "providerPaymentId" TEXT,
    "design" JSONB NOT NULL,
    "designHash" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "phoneE164" TEXT NOT NULL,
    "termsAcceptedAt" TIMESTAMP(3) NOT NULL,
    "emailStatus" "CardEmailStatus" NOT NULL DEFAULT 'NONE',
    "emailAttempts" INTEGER NOT NULL DEFAULT 0,
    "emailError" TEXT,
    "emailedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_exports" (
    "id" UUID NOT NULL,
    "kind" "CardExportKind" NOT NULL,
    "status" "CardExportStatus" NOT NULL DEFAULT 'QUEUED',
    "sessionId" UUID,
    "orderId" UUID,
    "leadId" UUID,
    "userId" UUID,
    "templateKey" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "design" JSONB NOT NULL,
    "designHash" TEXT NOT NULL,
    "storageKey" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "readyAt" TIMESTAMP(3),
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "firstDownloadedAt" TIMESTAMP(3),
    "lastDownloadedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_uploads" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "status" "CardUploadStatus" NOT NULL DEFAULT 'UPLOADING',
    "contentType" TEXT NOT NULL,
    "originalKey" TEXT NOT NULL,
    "storageKey" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "bytes" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_events" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "sessionId" UUID,
    "leadId" UUID,
    "orderId" UUID,
    "userId" UUID,
    "templateKey" TEXT,
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "card_sessions_tokenHash_key" ON "card_sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "card_sessions_lastSeenAt_idx" ON "card_sessions"("lastSeenAt");

-- CreateIndex
CREATE INDEX "card_sessions_templateKey_createdAt_idx" ON "card_sessions"("templateKey", "createdAt");

-- CreateIndex
CREATE INDEX "card_sessions_createdAt_idx" ON "card_sessions"("createdAt");

-- CreateIndex
CREATE INDEX "card_sessions_userId_idx" ON "card_sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "card_leads_phoneE164_key" ON "card_leads"("phoneE164");

-- CreateIndex
CREATE INDEX "card_leads_lastSeenAt_idx" ON "card_leads"("lastSeenAt");

-- CreateIndex
CREATE INDEX "card_leads_email_idx" ON "card_leads"("email");

-- CreateIndex
CREATE UNIQUE INDEX "card_orders_tokenHash_key" ON "card_orders"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "card_orders_reference_key" ON "card_orders"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "card_orders_providerOrderId_key" ON "card_orders"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "card_orders_providerPaymentId_key" ON "card_orders"("providerPaymentId");

-- CreateIndex
CREATE INDEX "card_orders_status_createdAt_idx" ON "card_orders"("status", "createdAt");

-- CreateIndex
CREATE INDEX "card_orders_paidAt_idx" ON "card_orders"("paidAt");

-- CreateIndex
CREATE INDEX "card_orders_leadId_idx" ON "card_orders"("leadId");

-- CreateIndex
CREATE INDEX "card_orders_email_idx" ON "card_orders"("email");

-- CreateIndex
CREATE INDEX "card_orders_sessionId_designHash_idx" ON "card_orders"("sessionId", "designHash");

-- CreateIndex
CREATE INDEX "card_exports_sessionId_kind_designHash_idx" ON "card_exports"("sessionId", "kind", "designHash");

-- CreateIndex
CREATE INDEX "card_exports_orderId_idx" ON "card_exports"("orderId");

-- CreateIndex
CREATE INDEX "card_exports_status_expiresAt_idx" ON "card_exports"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "card_exports_kind_createdAt_idx" ON "card_exports"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "card_uploads_sessionId_idx" ON "card_uploads"("sessionId");

-- CreateIndex
CREATE INDEX "card_uploads_status_createdAt_idx" ON "card_uploads"("status", "createdAt");

-- CreateIndex
CREATE INDEX "card_events_type_createdAt_idx" ON "card_events"("type", "createdAt");

-- CreateIndex
CREATE INDEX "card_events_templateKey_type_idx" ON "card_events"("templateKey", "type");

-- CreateIndex
CREATE INDEX "card_events_sessionId_idx" ON "card_events"("sessionId");

-- CreateIndex
CREATE INDEX "card_events_orderId_idx" ON "card_events"("orderId");

-- CreateIndex
CREATE INDEX "consents_cardLeadId_idx" ON "consents"("cardLeadId");

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_cardLeadId_fkey" FOREIGN KEY ("cardLeadId") REFERENCES "card_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_sessions" ADD CONSTRAINT "card_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_sessions" ADD CONSTRAINT "card_sessions_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "card_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_orders" ADD CONSTRAINT "card_orders_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "card_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_orders" ADD CONSTRAINT "card_orders_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "card_leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_exports" ADD CONSTRAINT "card_exports_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "card_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_exports" ADD CONSTRAINT "card_exports_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "card_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_exports" ADD CONSTRAINT "card_exports_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "card_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_uploads" ADD CONSTRAINT "card_uploads_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "card_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_events" ADD CONSTRAINT "card_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "card_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_events" ADD CONSTRAINT "card_events_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "card_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_events" ADD CONSTRAINT "card_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "card_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Hand-written: a repeated click reuses what is already there. One live export per
-- design and kind of a card (free or plan), one live export per paid order, and one
-- open order per design of a card.
CREATE UNIQUE INDEX "card_exports_live_per_design" ON "card_exports" ("sessionId", "kind", "designHash") WHERE "status" IN ('QUEUED', 'RENDERING', 'READY') AND "kind" IN ('FREE', 'PLAN') AND "sessionId" IS NOT NULL;
CREATE UNIQUE INDEX "card_exports_live_per_order" ON "card_exports" ("orderId") WHERE "status" IN ('QUEUED', 'RENDERING', 'READY') AND "orderId" IS NOT NULL;
CREATE UNIQUE INDEX "card_orders_open_per_design" ON "card_orders" ("sessionId", "designHash") WHERE "status" = 'PENDING' AND "sessionId" IS NOT NULL;
ALTER TABLE "card_orders" ADD CONSTRAINT "card_orders_amount_positive" CHECK ("amountMinor" > 0);
