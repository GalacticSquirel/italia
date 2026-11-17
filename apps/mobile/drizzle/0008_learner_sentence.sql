CREATE TABLE `learner_sentence` (
	`id` integer PRIMARY KEY NOT NULL,
	`it` text NOT NULL,
	`original` text NOT NULL,
	`error_tags` text NOT NULL,
	`grammar_ids` text NOT NULL,
	`source` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "learner_sentence_negative_id" CHECK("learner_sentence"."id" < 0)
);
