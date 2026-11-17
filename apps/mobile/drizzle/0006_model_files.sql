CREATE TABLE `model_file` (
	`model_id` text NOT NULL,
	`name` text NOT NULL,
	`sha256` text NOT NULL,
	`status` text NOT NULL,
	`bytes_done` integer DEFAULT 0 NOT NULL,
	`resume_data` text,
	`error` text,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`model_id`, `name`)
);
