-- AlterEnum
ALTER TYPE "PlatformRole" ADD VALUE 'SUPER_ADMIN';
ALTER TYPE "PlatformRole" ADD VALUE 'CONTENT_MANAGER';
ALTER TYPE "PlatformRole" ADD VALUE 'FINANCE_MANAGER';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "grantedById" UUID,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'PURCHASE',
ADD COLUMN     "note" TEXT;

-- CreateTable
CREATE TABLE "platform_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL DEFAULT '{}',
    "secrets" JSONB NOT NULL DEFAULT '{}',
    "lastCheck" JSONB,
    "updatedById" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");
