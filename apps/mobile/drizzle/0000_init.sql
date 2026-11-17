CREATE TABLE `card` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`target_id` integer NOT NULL,
	`prompt_mode` text NOT NULL,
	`due` integer NOT NULL,
	`stability` real DEFAULT 0 NOT NULL,
	`difficulty` real DEFAULT 0 NOT NULL,
	`scheduled_days` integer DEFAULT 0 NOT NULL,
	`learning_steps` integer DEFAULT 0 NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`lapses` integer DEFAULT 0 NOT NULL,
	`state` text DEFAULT 'new' NOT NULL,
	`last_review` integer,
	`suspended` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `card_target_unique` ON `card` (`kind`,`target_id`,`prompt_mode`);--> statement-breakpoint
CREATE INDEX `card_due_idx` ON `card` (`suspended`,`due`);--> statement-breakpoint
CREATE INDEX `card_state_idx` ON `card` (`state`);--> statement-breakpoint
CREATE TABLE `error_record` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`example` text NOT NULL,
	`source` text NOT NULL,
	`card_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `card`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `error_record_category_idx` ON `error_record` (`category`);--> statement-breakpoint
CREATE INDEX `error_record_card_idx` ON `error_record` (`card_id`);--> statement-breakpoint
CREATE TABLE `grammar_point` (
	`id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`order` integer NOT NULL,
	`prerequisite_ids` text NOT NULL,
	`note_md` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `grammar_point_order_unique` ON `grammar_point` (`order`);--> statement-breakpoint
CREATE TABLE `lemma` (
	`id` integer PRIMARY KEY NOT NULL,
	`lemma` text NOT NULL,
	`pos` text NOT NULL,
	`freq_rank` integer NOT NULL,
	`gloss_en` text NOT NULL,
	`audio_ref` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lemma_lemma_pos_unique` ON `lemma` (`lemma`,`pos`);--> statement-breakpoint
CREATE UNIQUE INDEX `lemma_freq_rank_unique` ON `lemma` (`freq_rank`);--> statement-breakpoint
CREATE TABLE `review_log` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`rating` text NOT NULL,
	`answer` text,
	`latency_ms` integer NOT NULL,
	`reviewed_at` integer NOT NULL,
	`device_id` text NOT NULL,
	`synced_at` integer,
	FOREIGN KEY (`card_id`) REFERENCES `card`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "review_log_latency_nonnegative" CHECK("review_log"."latency_ms" >= 0)
);
--> statement-breakpoint
CREATE INDEX `review_log_card_reviewed_idx` ON `review_log` (`card_id`,`reviewed_at`);--> statement-breakpoint
CREATE INDEX `review_log_reviewed_idx` ON `review_log` (`reviewed_at`);--> statement-breakpoint
CREATE INDEX `review_log_unsynced_idx` ON `review_log` (`synced_at`);--> statement-breakpoint
CREATE TABLE `sentence` (
	`id` integer PRIMARY KEY NOT NULL,
	`it` text NOT NULL,
	`en` text NOT NULL,
	`lemma_ids` text NOT NULL,
	`grammar_ids` text NOT NULL,
	`source` text NOT NULL,
	`licence` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sentence_source_idx` ON `sentence` (`source`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `story` (
	`id` text PRIMARY KEY NOT NULL,
	`level` text NOT NULL,
	`series_id` text,
	`series_index` integer,
	`title` text NOT NULL,
	`body_json` text NOT NULL,
	`audio_ref` text,
	`word_timings` text,
	`source` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `story_level_idx` ON `story` (`level`);--> statement-breakpoint
CREATE UNIQUE INDEX `story_series_unique` ON `story` (`series_id`,`series_index`);--> statement-breakpoint
CREATE TABLE `streak_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`current_days` integer DEFAULT 0 NOT NULL,
	`longest_days` integer DEFAULT 0 NOT NULL,
	`last_study_date` text,
	`freezes_available` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "streak_state_singleton" CHECK("streak_state"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE `study_session` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`minutes_active` real DEFAULT 0 NOT NULL,
	`activities` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `study_session_started_idx` ON `study_session` (`started_at`);