-- CreateEnum
CREATE TYPE "MemberInviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'LOCKED');

-- CreateEnum
CREATE TYPE "MediaAlbumKind" AS ENUM ('GENERAL', 'FUNCTION', 'CUSTOM');

-- AlterTable
ALTER TABLE "access_policies" ADD COLUMN     "linkExpiresAt" TIMESTAMP(3),
ADD COLUMN     "linkTokenCiphertext" TEXT,
ADD COLUMN     "linkTokenHash" TEXT;

-- AlterTable
ALTER TABLE "media_rooms" ADD COLUMN     "isMain" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "media_items" ADD COLUMN     "albumId" UUID;

-- CreateTable
CREATE TABLE "event_member_invites" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "role" "EventRole" NOT NULL,
    "functionIds" UUID[] DEFAULT ARRAY[]::UUID[],
    "tokenHash" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "status" "MemberInviteStatus" NOT NULL DEFAULT 'PENDING',
    "invitedById" UUID,
    "acceptedById" UUID,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_member_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_albums" (
    "id" UUID NOT NULL,
    "roomId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "kind" "MediaAlbumKind" NOT NULL,
    "name" TEXT NOT NULL,
    "functionId" UUID,
    "showInGallery" BOOLEAN NOT NULL DEFAULT true,
    "showOnWall" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_albums_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_member_invites_tokenHash_key" ON "event_member_invites"("tokenHash");

-- CreateIndex
CREATE INDEX "event_member_invites_eventId_status_idx" ON "event_member_invites"("eventId", "status");

-- CreateIndex
CREATE INDEX "event_member_invites_email_status_idx" ON "event_member_invites"("email", "status");

-- CreateIndex
CREATE INDEX "media_albums_eventId_idx" ON "media_albums"("eventId");

-- CreateIndex
CREATE INDEX "media_albums_roomId_sortOrder_idx" ON "media_albums"("roomId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "access_policies_linkTokenHash_key" ON "access_policies"("linkTokenHash");

-- CreateIndex
CREATE INDEX "media_items_albumId_status_createdAt_idx" ON "media_items"("albumId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "event_member_invites" ADD CONSTRAINT "event_member_invites_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_member_invites" ADD CONSTRAINT "event_member_invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_albums" ADD CONSTRAINT "media_albums_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "media_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_albums" ADD CONSTRAINT "media_albums_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "event_functions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "media_albums"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Hand-written: partial unique indexes.
-- One pending team invitation per event and email.
CREATE UNIQUE INDEX "event_member_invites_pending_key" ON "event_member_invites" ("eventId", "email") WHERE "status" = 'PENDING';
-- One main album per event.
CREATE UNIQUE INDEX "media_rooms_one_main_key" ON "media_rooms" ("eventId") WHERE "isMain";
-- One General sub-album per main album, and one sub-album per function.
CREATE UNIQUE INDEX "media_albums_one_general_key" ON "media_albums" ("roomId") WHERE "kind" = 'GENERAL';
CREATE UNIQUE INDEX "media_albums_one_per_function_key" ON "media_albums" ("roomId", "functionId") WHERE "functionId" IS NOT NULL;
