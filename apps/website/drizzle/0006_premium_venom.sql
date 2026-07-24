CREATE TABLE `live_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`requester_token_id` text NOT NULL,
	`key` text,
	`schema_version` integer NOT NULL,
	`props` text NOT NULL,
	`status` text DEFAULT 'starting' NOT NULL,
	`sequence` integer DEFAULT 0 NOT NULL,
	`accepted_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`idempotency_key` text,
	`request_hash` text,
	`expires_at` integer NOT NULL,
	`stale_at` integer,
	`dismissal_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requester_token_id`) REFERENCES `api_token`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `live_activity_token_idempotency_unique` ON `live_activity` (`requester_token_id`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `live_activity_token_key_unique` ON `live_activity` (`requester_token_id`,`key`);--> statement-breakpoint
CREATE INDEX `live_activity_user_status_updated_idx` ON `live_activity` (`user_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `live_activity_token_created_idx` ON `live_activity` (`requester_token_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `live_activity_delivery` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`device_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`environment` text NOT NULL,
	`schema_version` integer NOT NULL,
	`native_activity_id` text,
	`update_token_ciphertext` text,
	`update_token_updated_at` integer,
	`last_event` text,
	`last_sequence` integer DEFAULT -1 NOT NULL,
	`last_apns_status` integer,
	`last_apns_reason` text,
	`last_apns_id` text,
	`last_attempt_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ended_at` integer,
	FOREIGN KEY (`activity_id`) REFERENCES `live_activity`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`device_id`) REFERENCES `device`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `live_activity_delivery_activity_device_unique` ON `live_activity_delivery` (`activity_id`,`device_id`);--> statement-breakpoint
CREATE INDEX `live_activity_delivery_device_status_idx` ON `live_activity_delivery` (`device_id`,`status`);--> statement-breakpoint
CREATE INDEX `live_activity_delivery_native_id_idx` ON `live_activity_delivery` (`native_activity_id`);--> statement-breakpoint
CREATE TABLE `live_activity_delivery_attempt` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`delivery_id` text NOT NULL,
	`operation_id` text NOT NULL,
	`requester_token_id` text NOT NULL,
	`event` text NOT NULL,
	`sequence` integer NOT NULL,
	`apns_status` integer,
	`apns_reason` text,
	`apns_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `live_activity`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`delivery_id`) REFERENCES `live_activity_delivery`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`operation_id`) REFERENCES `live_activity_operation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requester_token_id`) REFERENCES `api_token`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `live_activity_attempt_token_created_idx` ON `live_activity_delivery_attempt` (`requester_token_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `live_activity_attempt_activity_created_idx` ON `live_activity_delivery_attempt` (`activity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `live_activity_operation` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`requester_token_id` text NOT NULL,
	`event` text NOT NULL,
	`sequence` integer NOT NULL,
	`idempotency_key` text,
	`request_hash` text,
	`accepted_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `live_activity`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requester_token_id`) REFERENCES `api_token`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `live_activity_operation_token_idempotency_unique` ON `live_activity_operation` (`requester_token_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `live_activity_operation_token_created_idx` ON `live_activity_operation` (`requester_token_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `live_activity_operation_activity_created_idx` ON `live_activity_operation` (`activity_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `device` ADD `live_activity_push_to_start_token_ciphertext` text;--> statement-breakpoint
ALTER TABLE `device` ADD `live_activity_token_environment` text;--> statement-breakpoint
ALTER TABLE `device` ADD `live_activity_schema_version` integer;--> statement-breakpoint
ALTER TABLE `device` ADD `live_activity_token_updated_at` integer;