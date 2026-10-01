-- AlterTable
ALTER TABLE "templates" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "templates_deletedAt_idx" ON "templates"("deletedAt");
