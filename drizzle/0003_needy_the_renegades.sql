CREATE TABLE `syndic_login_rate_limits` (
	`scope` varchar(255) NOT NULL,
	`failures` int NOT NULL DEFAULT 0,
	`windowStartedAt` timestamp NOT NULL,
	`blockedUntil` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `syndic_login_rate_limits_scope` PRIMARY KEY(`scope`)
);
--> statement-breakpoint
CREATE TABLE `syndic_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `syndic_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `syndic_sessions_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
ALTER TABLE `syndic_sessions` ADD CONSTRAINT `syndic_sessions_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;