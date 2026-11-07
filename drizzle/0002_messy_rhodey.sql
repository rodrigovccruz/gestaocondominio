CREATE TABLE `condo_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`unitId` varchar(80) NOT NULL,
	`tokenHash` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`acceptedAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `condo_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `condo_invites_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `condo_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`userId` int NOT NULL,
	`unitId` varchar(80) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `condo_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `condo_memberships_userId_unique` UNIQUE(`userId`),
	CONSTRAINT `condo_memberships_ownerId_unitId_unique` UNIQUE(`ownerId`,`unitId`)
);
--> statement-breakpoint
ALTER TABLE `condo_invites` ADD CONSTRAINT `condo_invites_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `condo_memberships` ADD CONSTRAINT `condo_memberships_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `condo_memberships` ADD CONSTRAINT `condo_memberships_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;