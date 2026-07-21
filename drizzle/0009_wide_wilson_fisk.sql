ALTER TABLE `reservations` ADD `hasPet` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` ADD `dogCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` ADD `dogsUnder25Lbs` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `reservations` ADD `petPolicyAcknowledged` int DEFAULT 0 NOT NULL;