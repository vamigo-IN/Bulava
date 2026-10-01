-- DropIndex
DROP INDEX "event_domains_hostname_key";

-- CreateIndex
CREATE INDEX "event_domains_hostname_idx" ON "event_domains"("hostname");


-- Hand-written: several events may claim a hostname (so nobody can squat a
-- name they do not own), but only one claim at a time can prove ownership.
CREATE UNIQUE INDEX "event_domains_hostname_verified_key" ON "event_domains"("hostname") WHERE "verifiedAt" IS NOT NULL;
