ALTER TABLE `exams` DROP COLUMN `subjects`;
--> statement-breakpoint
ALTER TABLE `exams` ADD COLUMN `subjectCounts` json NOT NULL DEFAULT ('[]');
