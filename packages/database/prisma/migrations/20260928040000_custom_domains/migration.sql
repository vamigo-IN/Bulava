-- CreateEnum
CREATE TYPE "DomainStatus" AS ENUM ('PENDING', 'ACTIVE', 'FAILED');

-- CreateTable
CREATE TABLE "event_domains" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "hostname" TEXT NOT NULL,
    "status" "DomainStatus" NOT NULL DEFAULT 'PENDING',
    "verificationToken" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "providerId" TEXT,
    "sslStatus" TEXT,
    "lastError" TEXT,
    "failedChecks" INTEGER NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_domains_eventId_key" ON "event_domains"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "event_domains_hostname_key" ON "event_domains"("hostname");

-- CreateIndex
CREATE INDEX "event_domains_status_lastCheckedAt_idx" ON "event_domains"("status", "lastCheckedAt");

-- AddForeignKey
ALTER TABLE "event_domains" ADD CONSTRAINT "event_domains_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-written: hostnames are stored normalised.
ALTER TABLE "event_domains" ADD CONSTRAINT "event_domains_hostname_lowercase" CHECK ("hostname" = lower("hostname") AND length("hostname") <= 253);
