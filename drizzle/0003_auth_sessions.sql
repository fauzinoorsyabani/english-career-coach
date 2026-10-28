CREATE TABLE `user_sessions` (
	`id` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`userAgent` text,
	`ipAddress` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `user_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `status` enum('active','disabled') DEFAULT 'active' NOT NULL;--> statement-breakpoint
CREATE INDEX `session_user_seen_idx` ON `user_sessions` (`userId`,`lastSeenAt`);--> statement-breakpoint
CREATE INDEX `session_expires_idx` ON `user_sessions` (`expiresAt`);