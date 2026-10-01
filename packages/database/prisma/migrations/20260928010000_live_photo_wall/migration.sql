-- AlterTable
ALTER TABLE "media_rooms" ADD COLUMN     "wallTokenCiphertext" TEXT,
ADD COLUMN     "wallTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "media_rooms_wallTokenHash_key" ON "media_rooms"("wallTokenHash");


-- Hand-written: the hash and the ciphertext are set and cleared together.
ALTER TABLE "media_rooms" ADD CONSTRAINT "media_rooms_wall_token_pair" CHECK (("wallTokenHash" IS NULL) = ("wallTokenCiphertext" IS NULL));
