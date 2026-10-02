CREATE TABLE `answer_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_slug` text NOT NULL,
	`category` text NOT NULL,
	`current_plan_slug` text,
	`user_monthly_price` real,
	`answers` text NOT NULL,
	`questions_asked` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`recommended_plan_slug` text,
	`monthly_difference` real,
	`recorded_on` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `answer_records_product_idx` ON `answer_records` (`product_slug`);--> statement-breakpoint
CREATE INDEX `answer_records_day_idx` ON `answer_records` (`recorded_on`);