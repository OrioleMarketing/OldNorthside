CREATE TABLE `booking_email_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reservationId` int NOT NULL,
	`kind` enum('booking_confirmation','balance_reminder','balance_receipt') NOT NULL,
	`status` enum('scheduled','sent','failed','cancelled') NOT NULL DEFAULT 'scheduled',
	`scheduledFor` timestamp,
	`sentAt` timestamp,
	`failedAt` timestamp,
	`providerMessageId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `booking_email_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `booking_email_event_unique` UNIQUE(`reservationId`,`kind`)
);
--> statement-breakpoint
CREATE TABLE `booking_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`depositNights` int NOT NULL DEFAULT 1,
	`balanceReminderDays` int NOT NULL DEFAULT 7,
	`stateTaxRateBasisPoints` int NOT NULL DEFAULT 700,
	`countyTaxRateBasisPoints` int NOT NULL DEFAULT 300,
	`shortTermTaxThresholdNights` int NOT NULL DEFAULT 30,
	`channelProvider` varchar(96),
	`channelConnectionStatus` enum('not_connected','pending','connected','error') NOT NULL DEFAULT 'not_connected',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `booking_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `channel_mappings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`provider` varchar(96) NOT NULL,
	`externalRoomId` varchar(160) NOT NULL,
	`externalRatePlanId` varchar(160),
	`isEnabled` int NOT NULL DEFAULT 1,
	`lastSyncedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `channel_mappings_id` PRIMARY KEY(`id`),
	CONSTRAINT `channel_mapping_unique` UNIQUE(`provider`,`roomId`,`externalRoomId`)
);
--> statement-breakpoint
CREATE TABLE `channel_sync_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(96) NOT NULL,
	`direction` enum('inbound','outbound') NOT NULL,
	`eventType` varchar(120) NOT NULL,
	`idempotencyKey` varchar(255) NOT NULL,
	`reservationId` int,
	`externalReservationId` varchar(160),
	`status` enum('received','processed','retrying','failed','ignored') NOT NULL DEFAULT 'received',
	`detail` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`processedAt` timestamp,
	CONSTRAINT `channel_sync_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `channel_sync_event_key_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `reservation_blocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roomId` int NOT NULL,
	`checkIn` date NOT NULL,
	`checkOut` date NOT NULL,
	`reason` varchar(240) NOT NULL,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reservation_blocks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookingReference` varchar(32) NOT NULL,
	`roomId` int NOT NULL,
	`guestName` varchar(180) NOT NULL,
	`guestEmail` varchar(320) NOT NULL,
	`guestPhone` varchar(50) NOT NULL,
	`guestCount` int NOT NULL DEFAULT 1,
	`checkIn` date NOT NULL,
	`checkOut` date NOT NULL,
	`status` enum('hold','pending_deposit','confirmed','cancelled','expired','blocked') NOT NULL DEFAULT 'hold',
	`source` enum('direct','channel','owner') NOT NULL DEFAULT 'direct',
	`nightlyRateCents` int NOT NULL,
	`subtotalCents` int NOT NULL,
	`stateTaxCents` int NOT NULL DEFAULT 0,
	`countyTaxCents` int NOT NULL DEFAULT 0,
	`totalCents` int NOT NULL,
	`depositDueCents` int NOT NULL,
	`balanceDueCents` int NOT NULL,
	`stripeDepositCheckoutSessionId` varchar(255),
	`stripeDepositPaymentIntentId` varchar(255),
	`stripeBalanceCheckoutSessionId` varchar(255),
	`stripeBalancePaymentIntentId` varchar(255),
	`depositPaidAt` timestamp,
	`balancePaidAt` timestamp,
	`balanceReminderAt` timestamp,
	`balanceReminderSentAt` timestamp,
	`balanceReminderTaskUid` varchar(65),
	`holdExpiresAt` timestamp,
	`channelReservationId` varchar(160),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reservations_id` PRIMARY KEY(`id`),
	CONSTRAINT `reservations_reference_unique` UNIQUE(`bookingReference`)
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(96) NOT NULL,
	`name` varchar(160) NOT NULL,
	`summary` text NOT NULL,
	`bed` varchar(120) NOT NULL,
	`bath` varchar(180) NOT NULL,
	`hasFireplace` int NOT NULL DEFAULT 0,
	`weekdayRateCents` int NOT NULL,
	`weekendRateCents` int NOT NULL,
	`imageUrl` varchar(500),
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `rooms_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE INDEX `booking_email_event_status_idx` ON `booking_email_events` (`status`,`scheduledFor`);--> statement-breakpoint
CREATE INDEX `channel_sync_event_reservation_idx` ON `channel_sync_events` (`reservationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `reservation_blocks_room_dates_idx` ON `reservation_blocks` (`roomId`,`checkIn`,`checkOut`);--> statement-breakpoint
CREATE INDEX `reservations_room_dates_idx` ON `reservations` (`roomId`,`checkIn`,`checkOut`);--> statement-breakpoint
CREATE INDEX `reservations_status_dates_idx` ON `reservations` (`status`,`checkIn`);--> statement-breakpoint
CREATE INDEX `reservations_balance_task_idx` ON `reservations` (`balanceReminderTaskUid`);--> statement-breakpoint
CREATE INDEX `rooms_active_order_idx` ON `rooms` (`isActive`,`sortOrder`);