CREATE TABLE `booking_event_restrictions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`eventStart` date NOT NULL,
	`eventEnd` date NOT NULL,
	`minimumNights` int NOT NULL DEFAULT 1,
	`bookingOpensOn` date,
	`bookingClosesOn` date,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `booking_event_restrictions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `booking_event_restrictions_dates_idx` ON `booking_event_restrictions` (`eventStart`,`eventEnd`);