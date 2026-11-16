ALTER TABLE `streak_state` ADD `day_date` text;--> statement-breakpoint
ALTER TABLE `streak_state` ADD `day_active_minutes` real;--> statement-breakpoint
ALTER TABLE `streak_state` ADD `day_completed_sessions` integer;--> statement-breakpoint
ALTER TABLE `streak_state` ADD `repair_missed_date` text;--> statement-breakpoint
ALTER TABLE `streak_state` ADD `repair_lost_days` integer;--> statement-breakpoint
ALTER TABLE `streak_state` ADD `repair_freezes_needed` integer;