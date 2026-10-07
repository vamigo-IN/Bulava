-- CreateEnum
CREATE TYPE "SitePageLayout" AS ENUM ('DOCUMENT', 'CARDS', 'CONTACT');

-- CreateEnum
CREATE TYPE "SitePageStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "SitePageFooterGroup" AS ENUM ('COMPANY', 'LEGAL');

-- CreateEnum
CREATE TYPE "ContactTopic" AS ENUM ('GENERAL', 'EVENT_HELP', 'BILLING', 'PARTNERSHIP', 'PRIVACY', 'FEEDBACK');

-- CreateEnum
CREATE TYPE "ContactStatus" AS ENUM ('NEW', 'OPEN', 'RESOLVED', 'SPAM');

-- AlterEnum
ALTER TYPE "UserStatus" ADD VALUE 'PENDING_DELETION';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "deletionScheduledAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "site_pages" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "layout" "SitePageLayout" NOT NULL DEFAULT 'DOCUMENT',
    "status" "SitePageStatus" NOT NULL DEFAULT 'DRAFT',
    "system" BOOLEAN NOT NULL DEFAULT false,
    "footerGroup" "SitePageFooterGroup",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "sections" JSONB NOT NULL DEFAULT '[]',
    "publishedAt" TIMESTAMP(3),
    "updatedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_messages" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "phone" TEXT,
    "topic" "ContactTopic" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ContactStatus" NOT NULL DEFAULT 'NEW',
    "note" TEXT,
    "handledById" UUID,
    "repliedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_replies" (
    "id" UUID NOT NULL,
    "messageId" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "sentById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_replies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_pages_slug_key" ON "site_pages"("slug");

-- CreateIndex
CREATE INDEX "site_pages_status_footerGroup_sortOrder_idx" ON "site_pages"("status", "footerGroup", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "contact_messages_reference_key" ON "contact_messages"("reference");

-- CreateIndex
CREATE INDEX "contact_messages_status_createdAt_idx" ON "contact_messages"("status", "createdAt");

-- CreateIndex
CREATE INDEX "contact_messages_email_idx" ON "contact_messages"("email");

-- CreateIndex
CREATE INDEX "contact_replies_messageId_createdAt_idx" ON "contact_replies"("messageId", "createdAt");

-- CreateIndex
CREATE INDEX "users_status_deletionScheduledAt_idx" ON "users"("status", "deletionScheduledAt");

-- AddForeignKey
ALTER TABLE "contact_replies" ADD CONSTRAINT "contact_replies_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "contact_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

