CREATE TABLE `reservation_audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reservationId` int,
	`reservationBlockId` int,
	`action` enum('reservation_cancelled','block_cancelled','payment_link_created','off_session_charge_attempted','off_session_charge_succeeded','off_session_charge_failed') NOT NULL,
	`actorUserId` int,
	`stripePaymentIntentId` varchar(255),
	`detail` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reservation_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `reservation_blocks` ADD `status` enum('active','cancelled') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `reservation_blocks` ADD `cancelledAt` timestamp;--> statement-breakpoint
ALTER TABLE `reservation_blocks` ADD `cancelledByUserId` int;--> statement-breakpoint
ALTER TABLE `reservation_blocks` ADD `cancellationReason` varchar(240);--> statement-breakpoint
ALTER TABLE `reservations` ADD `stripeCustomerId` varchar(255);--> statement-breakpoint
ALTER TABLE `reservations` ADD `stripePaymentMethodId` varchar(255);--> statement-breakpoint
ALTER TABLE `reservations` ADD `cancelledAt` timestamp;--> statement-breakpoint
ALTER TABLE `reservations` ADD `cancelledByUserId` int;--> statement-breakpoint
ALTER TABLE `reservations` ADD `cancellationReason` varchar(240);--> statement-breakpoint
CREATE INDEX `reservation_audit_reservation_idx` ON `reservation_audit_events` (`reservationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `reservation_audit_block_idx` ON `reservation_audit_events` (`reservationBlockId`,`createdAt`);