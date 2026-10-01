-- AlterTable
ALTER TABLE "event_functions" ADD COLUMN     "reminderSentFor" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "event_reminder_settings" (
    "eventId" UUID NOT NULL,
    "rsvpReminderAt" TIMESTAMP(3),
    "rsvpReminderSentAt" TIMESTAMP(3),
    "rsvpReminderRecipients" INTEGER,
    "functionReminderHours" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_reminder_settings_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE INDEX "event_reminder_settings_rsvpReminderAt_idx" ON "event_reminder_settings"("rsvpReminderAt");

-- AddForeignKey
ALTER TABLE "event_reminder_settings" ADD CONSTRAINT "event_reminder_settings_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Hand-written: reminders at least an hour and at most a week before a function.
ALTER TABLE "event_reminder_settings" ADD CONSTRAINT "event_reminder_settings_hours_range" CHECK ("functionReminderHours" IS NULL OR "functionReminderHours" BETWEEN 1 AND 168);
