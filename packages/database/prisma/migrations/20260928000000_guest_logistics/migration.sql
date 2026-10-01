-- CreateEnum
CREATE TYPE "TravelDirection" AS ENUM ('ARRIVAL', 'DEPARTURE');

-- CreateEnum
CREATE TYPE "TravelMode" AS ENUM ('FLIGHT', 'TRAIN', 'ROAD', 'BUS', 'OTHER');

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "collectGuestTravel" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "function_guests" DROP COLUMN "mealPreference",
DROP COLUMN "tableLabel";

-- AlterTable
ALTER TABLE "guests" ADD COLUMN     "dietary" TEXT,
ADD COLUMN     "isVip" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "seat_assignments" (
    "functionId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "tableLabel" TEXT NOT NULL,
    "seatLabel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seat_assignments_pkey" PRIMARY KEY ("functionId","guestId")
);

-- CreateTable
CREATE TABLE "guest_stays" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "hotelName" TEXT NOT NULL,
    "address" TEXT,
    "mapUrl" TEXT,
    "roomNumber" TEXT,
    "roomType" TEXT,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_stays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_travel" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "direction" "TravelDirection" NOT NULL,
    "mode" "TravelMode" NOT NULL,
    "carrier" TEXT,
    "reference" TEXT,
    "at" TIMESTAMP(3) NOT NULL,
    "place" TEXT,
    "travellers" INTEGER NOT NULL DEFAULT 1,
    "pickupRequested" BOOLEAN NOT NULL DEFAULT false,
    "pickupNote" TEXT,
    "enteredByGuest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_travel_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seat_assignments_eventId_functionId_idx" ON "seat_assignments"("eventId", "functionId");

-- CreateIndex
CREATE INDEX "seat_assignments_guestId_idx" ON "seat_assignments"("guestId");

-- CreateIndex
CREATE UNIQUE INDEX "guest_stays_guestId_key" ON "guest_stays"("guestId");

-- CreateIndex
CREATE INDEX "guest_stays_eventId_hotelName_idx" ON "guest_stays"("eventId", "hotelName");

-- CreateIndex
CREATE INDEX "guest_travel_eventId_direction_at_idx" ON "guest_travel"("eventId", "direction", "at");

-- CreateIndex
CREATE UNIQUE INDEX "guest_travel_guestId_direction_key" ON "guest_travel"("guestId", "direction");

-- AddForeignKey
ALTER TABLE "seat_assignments" ADD CONSTRAINT "seat_assignments_functionId_fkey" FOREIGN KEY ("functionId") REFERENCES "event_functions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_assignments" ADD CONSTRAINT "seat_assignments_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seat_assignments" ADD CONSTRAINT "seat_assignments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_stays" ADD CONSTRAINT "guest_stays_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_stays" ADD CONSTRAINT "guest_stays_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_travel" ADD CONSTRAINT "guest_travel_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_travel" ADD CONSTRAINT "guest_travel_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-written checks.
ALTER TABLE "guest_travel" ADD CONSTRAINT "guest_travel_travellers_range" CHECK ("travellers" BETWEEN 1 AND 50);
ALTER TABLE "guest_stays" ADD CONSTRAINT "guest_stays_dates_ordered" CHECK ("checkInAt" IS NULL OR "checkOutAt" IS NULL OR "checkOutAt" >= "checkInAt");
