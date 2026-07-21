CREATE TABLE `channel_inventory_blocks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(96) NOT NULL,
	`externalReservationId` varchar(160) NOT NULL,
	`roomId` int NOT NULL,
	`checkIn` date NOT NULL,
	`checkOut` date NOT NULL,
	`status` enum('active','cancelled','conflict') NOT NULL DEFAULT 'active',
	`originEventKey` varchar(255) NOT NULL,
	`lastEventVersion` varchar(160),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `channel_inventory_blocks_id` PRIMARY KEY(`id`),
	CONSTRAINT `channel_inventory_block_unique` UNIQUE(`provider`,`externalReservationId`)
);
--> statement-breakpoint
CREATE INDEX `channel_inventory_block_room_dates_idx` ON `channel_inventory_blocks` (`roomId`,`checkIn`,`checkOut`);