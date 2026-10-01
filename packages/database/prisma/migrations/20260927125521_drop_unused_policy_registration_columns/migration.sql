-- The registration flags on access policies were never used; registration lives in event_registration_settings.
-- AlterTable
ALTER TABLE "access_policies" DROP COLUMN "registrationEnabled",
DROP COLUMN "registrationSettings";

