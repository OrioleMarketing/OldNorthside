CREATE TABLE `website_admin_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(180) NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`createdByAdminId` int NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`activatedAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `website_admin_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `website_admin_invites_email_unique` UNIQUE(`email`),
	CONSTRAINT `website_admin_invites_token_hash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE INDEX `website_admin_invites_status_idx` ON `website_admin_invites` (`expiresAt`,`activatedAt`,`revokedAt`);