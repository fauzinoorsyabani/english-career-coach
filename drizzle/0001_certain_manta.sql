CREATE TABLE `learner_profiles` (
	`id` varchar(24) NOT NULL,
	`userId` int NOT NULL,
	`englishLevel` varchar(32) NOT NULL DEFAULT 'Intermediate',
	`targetRole` varchar(120) NOT NULL DEFAULT 'Information Systems Professional',
	`focusAreas` json NOT NULL,
	`dailyGoal` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `learner_profiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `learner_profile_user_idx` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `practice_attempts` (
	`id` varchar(24) NOT NULL,
	`userId` int NOT NULL,
	`activityType` enum('vocabulary','grammar','rewrite','writing') NOT NULL,
	`prompt` text NOT NULL,
	`response` text NOT NULL,
	`score` int NOT NULL,
	`feedback` json NOT NULL,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `practice_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scenario_completions` (
	`id` varchar(24) NOT NULL,
	`userId` int NOT NULL,
	`scenarioSlug` varchar(80) NOT NULL,
	`conversationId` varchar(24),
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scenario_completions_id` PRIMARY KEY(`id`),
	CONSTRAINT `completion_user_scenario_idx` UNIQUE(`userId`,`scenarioSlug`)
);
--> statement-breakpoint
CREATE TABLE `tutor_conversations` (
	`id` varchar(24) NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(180) NOT NULL,
	`mode` enum('general','workplace','interview','it_vocabulary') NOT NULL,
	`scenarioSlug` varchar(80),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tutor_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tutor_messages` (
	`id` varchar(24) NOT NULL,
	`conversationId` varchar(24) NOT NULL,
	`userId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tutor_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `attempt_user_completed_idx` ON `practice_attempts` (`userId`,`completedAt`);--> statement-breakpoint
CREATE INDEX `conversation_user_updated_idx` ON `tutor_conversations` (`userId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `message_conversation_user_idx` ON `tutor_messages` (`conversationId`,`userId`);