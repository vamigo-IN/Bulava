-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "renditions" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
