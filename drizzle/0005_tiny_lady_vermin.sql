ALTER TABLE `booking_email_events` ADD `manualResendCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `booking_email_events` ADD `lastManualResendAt` timestamp;