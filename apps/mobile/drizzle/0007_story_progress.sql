CREATE TABLE `lemma_exposure` (
	`lemma_id` integer PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`first_seen_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	CONSTRAINT "lemma_exposure_count_nonnegative" CHECK("lemma_exposure"."count" >= 0)
);
--> statement-breakpoint
CREATE TABLE `story_progress` (
	`story_id` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`times_read` integer DEFAULT 0 NOT NULL,
	`last_sentence` integer DEFAULT 0 NOT NULL,
	`words_read` integer DEFAULT 0 NOT NULL,
	`comprehension_correct` integer,
	`comprehension_total` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `story_progress_completed_idx` ON `story_progress` (`completed_at`);