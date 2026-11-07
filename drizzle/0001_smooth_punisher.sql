CREATE TABLE `condo_states` (
	`ownerId` int NOT NULL,
	`revision` int NOT NULL,
	`state` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `condo_states_ownerId_unique` UNIQUE(`ownerId`)
);
--> statement-breakpoint
ALTER TABLE `condo_states` ADD CONSTRAINT `condo_states_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;