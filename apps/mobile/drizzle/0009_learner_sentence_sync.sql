ALTER TABLE `learner_sentence` ADD `synced_at` integer;--> statement-breakpoint
CREATE INDEX `learner_sentence_unsynced_idx` ON `learner_sentence` (`synced_at`);