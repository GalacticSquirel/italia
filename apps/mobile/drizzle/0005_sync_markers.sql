ALTER TABLE `card` ADD `flag_updated_at` integer;--> statement-breakpoint
ALTER TABLE `card` ADD `flag_device_id` text;--> statement-breakpoint
ALTER TABLE `card` ADD `flag_synced_at` integer;--> statement-breakpoint
CREATE INDEX `card_flag_unsynced_idx` ON `card` (`flag_synced_at`,`flag_updated_at`);--> statement-breakpoint
ALTER TABLE `error_record` ADD `synced_at` integer;--> statement-breakpoint
CREATE INDEX `error_record_unsynced_idx` ON `error_record` (`synced_at`);--> statement-breakpoint
ALTER TABLE `settings` ADD `device_id` text;--> statement-breakpoint
ALTER TABLE `settings` ADD `synced_at` integer;--> statement-breakpoint
ALTER TABLE `study_session` ADD `synced_at` integer;--> statement-breakpoint
CREATE INDEX `study_session_unsynced_idx` ON `study_session` (`synced_at`);--> statement-breakpoint
-- Cards suspended before sync existed: give the flag a change time so it is pushed.
UPDATE `card` SET `flag_updated_at` = `created_at` WHERE `suspended` = 1;
