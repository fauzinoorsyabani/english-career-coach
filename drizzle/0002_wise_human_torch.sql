CREATE TABLE `daily_challenge_completions` (
	`id` varchar(24) NOT NULL,
	`userId` int NOT NULL,
	`challengeDate` varchar(10) NOT NULL,
	`challengeId` varchar(64) NOT NULL,
	`response` text NOT NULL,
	`completedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `daily_challenge_completions_id` PRIMARY KEY(`id`),
	CONSTRAINT `challenge_user_date_idx` UNIQUE(`userId`,`challengeDate`)
);
--> statement-breakpoint
CREATE TABLE `vocabulary_flashcards` (
	`id` varchar(24) NOT NULL,
	`userId` int NOT NULL,
	`term` varchar(100) NOT NULL,
	`definition` text NOT NULL,
	`example` text NOT NULL,
	`sourceConversationId` varchar(24),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	CONSTRAINT `vocabulary_flashcards_id` PRIMARY KEY(`id`),
	CONSTRAINT `flashcard_user_term_idx` UNIQUE(`userId`,`term`)
);
--> statement-breakpoint
CREATE INDEX `flashcard_user_created_idx` ON `vocabulary_flashcards` (`userId`,`createdAt`);