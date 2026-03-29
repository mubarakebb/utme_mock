CREATE TABLE `examResults` (
	`id` int AUTO_INCREMENT NOT NULL,
	`examSessionId` int NOT NULL,
	`userId` int NOT NULL,
	`totalQuestions` int NOT NULL,
	`correctAnswers` int NOT NULL,
	`wrongAnswers` int NOT NULL,
	`unanswered` int NOT NULL,
	`score` decimal(5,2) NOT NULL,
	`timeTaken` int NOT NULL,
	`performanceByTopic` json NOT NULL DEFAULT ('{}'),
	`answerDetails` json NOT NULL DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `examResults_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `examSessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`endedAt` timestamp,
	`status` enum('in_progress','submitted','abandoned') NOT NULL DEFAULT 'in_progress',
	`totalQuestions` int NOT NULL,
	`timeLimit` int NOT NULL,
	`currentQuestionIndex` int NOT NULL DEFAULT 0,
	`selectedAnswers` json NOT NULL DEFAULT ('{}'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `examSessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generatedQuestions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`topic` varchar(255) NOT NULL,
	`difficulty` enum('easy','medium','hard') NOT NULL,
	`prompt` longtext NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`approvedBy` int,
	`approvedAt` timestamp,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`questionId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `generatedQuestions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notificationPreferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`emailOnResultsReady` boolean NOT NULL DEFAULT true,
	`emailOnNewQuestions` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notificationPreferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `notificationPreferences_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`topic` varchar(255) NOT NULL,
	`difficulty` enum('easy','medium','hard') NOT NULL,
	`questionText` longtext NOT NULL,
	`optionA` longtext NOT NULL,
	`optionB` longtext NOT NULL,
	`optionC` longtext NOT NULL,
	`optionD` longtext NOT NULL,
	`correctAnswer` enum('A','B','C','D') NOT NULL,
	`explanation` longtext,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `questions_id` PRIMARY KEY(`id`)
);
