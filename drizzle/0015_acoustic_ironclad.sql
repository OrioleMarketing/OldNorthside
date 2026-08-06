ALTER TABLE `booking_settings` MODIFY COLUMN `balanceReminderDays` int NOT NULL DEFAULT 6;--> statement-breakpoint
ALTER TABLE `booking_settings` MODIFY COLUMN `countyTaxRateBasisPoints` int NOT NULL DEFAULT 1000;--> statement-breakpoint
ALTER TABLE `reservations` ADD `adultGuestDetailsJson` text;