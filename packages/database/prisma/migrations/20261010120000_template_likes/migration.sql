-- AlterTable
ALTER TABLE "templates" ADD COLUMN     "likeCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "template_likes" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "userId" UUID,
    "visitorHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "template_likes_userId_idx" ON "template_likes"("userId");

-- CreateIndex
CREATE INDEX "template_likes_visitorHash_idx" ON "template_likes"("visitorHash");

-- CreateIndex
CREATE UNIQUE INDEX "template_likes_templateId_userId_key" ON "template_likes"("templateId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "template_likes_templateId_visitorHash_key" ON "template_likes"("templateId", "visitorHash");

-- AddForeignKey
ALTER TABLE "template_likes" ADD CONSTRAINT "template_likes_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_likes" ADD CONSTRAINT "template_likes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A like comes from a signed-in person or from a browser: exactly one of the two.
ALTER TABLE "template_likes" ADD CONSTRAINT "template_likes_one_liker" CHECK (("userId" IS NULL) <> ("visitorHash" IS NULL));

-- Counts are real likes, so they never go below zero.
ALTER TABLE "templates" ADD CONSTRAINT "templates_like_count_nonnegative" CHECK ("likeCount" >= 0);
