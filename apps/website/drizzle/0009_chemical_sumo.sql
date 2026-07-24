CREATE TABLE `analytics_daily` (
	`day` text NOT NULL,
	`metric` text NOT NULL,
	`value` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analytics_daily_day_metric_unique` ON `analytics_daily` (`day`,`metric`);--> statement-breakpoint
CREATE TABLE `analytics_event` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`user_id` text,
	`service_id` text,
	`device_id` text,
	`plan` text,
	`outcome` text,
	`value` integer DEFAULT 0 NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `analytics_event_name_created_at_idx` ON `analytics_event` (`name`,`created_at`);--> statement-breakpoint
CREATE INDEX `analytics_event_user_created_at_idx` ON `analytics_event` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `analytics_event_created_at_idx` ON `analytics_event` (`created_at`);--> statement-breakpoint
CREATE TABLE `analytics_user_day` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analytics_user_day_user_day_unique` ON `analytics_user_day` (`user_id`,`day`);--> statement-breakpoint
CREATE INDEX `analytics_user_day_day_idx` ON `analytics_user_day` (`day`);