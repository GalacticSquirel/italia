CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
DROP INDEX `card_due_idx`;--> statement-breakpoint
DROP INDEX `card_state_idx`;--> statement-breakpoint
CREATE INDEX `card_due_order_idx` ON `card` (`suspended`,`due`,`id`);--> statement-breakpoint
CREATE INDEX `card_state_new_idx` ON `card` (`suspended`,`state`,`created_at`,`id`);--> statement-breakpoint
DROP INDEX `review_log_reviewed_idx`;--> statement-breakpoint
CREATE INDEX `review_log_reviewed_id_idx` ON `review_log` (`reviewed_at`,`id`);