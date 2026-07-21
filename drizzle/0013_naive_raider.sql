CREATE TABLE `website_admins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(180) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`role` enum('admin') NOT NULL DEFAULT 'admin',
	`isActive` int NOT NULL DEFAULT 1,
	`lastSignedIn` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `website_admins_id` PRIMARY KEY(`id`),
	CONSTRAINT `website_admins_email_unique` UNIQUE(`email`)
);
