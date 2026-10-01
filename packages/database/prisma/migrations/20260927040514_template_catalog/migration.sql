-- CreateEnum
CREATE TYPE "TemplateTier" AS ENUM ('FREE', 'STANDARD', 'PREMIUM');

-- AlterTable
ALTER TABLE "templates" ADD COLUMN     "badge" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tier" "TemplateTier" NOT NULL DEFAULT 'STANDARD';

-- CreateTable
CREATE TABLE "testimonials" (
    "id" UUID NOT NULL,
    "quote" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "location" TEXT,
    "eventLabel" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "testimonials_published_sortOrder_idx" ON "testimonials"("published", "sortOrder");

-- CreateIndex
CREATE INDEX "templates_status_featured_sortOrder_idx" ON "templates"("status", "featured", "sortOrder");

-- Ratings are 1..5.
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_rating_range" CHECK ("rating" BETWEEN 1 AND 5);
