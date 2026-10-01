-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'WAITLISTED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "event_registration_settings" (
    "eventId" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "fields" JSONB NOT NULL DEFAULT '[]',
    "maxRegistrations" INTEGER,
    "approvalRequired" BOOLEAN NOT NULL DEFAULT false,
    "waitlistEnabled" BOOLEAN NOT NULL DEFAULT false,
    "closesAt" TIMESTAMP(3),
    "groupId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_registration_settings_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "registrations" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "status" "RegistrationStatus" NOT NULL,
    "answers" JSONB NOT NULL DEFAULT '{}',
    "decidedById" UUID,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registrations_guestId_key" ON "registrations"("guestId");

-- CreateIndex
CREATE INDEX "registrations_eventId_status_createdAt_idx" ON "registrations"("eventId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "event_registration_settings" ADD CONSTRAINT "event_registration_settings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registrations" ADD CONSTRAINT "registrations_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written: a cap, when set, must be positive.
ALTER TABLE "event_registration_settings" ADD CONSTRAINT "event_registration_settings_max_positive" CHECK ("maxRegistrations" IS NULL OR "maxRegistrations" > 0);
