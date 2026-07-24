CREATE TABLE `api_token` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`prefix` text NOT NULL,
	`scopes` text NOT NULL,
	`expires_at` integer,
	`last_used_at` integer,
	`created_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_token_token_hash_unique` ON `api_token` (`token_hash`);--> statement-breakpoint
CREATE INDEX `api_token_user_created_at_idx` ON `api_token` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `api_token_prefix_idx` ON `api_token` (`prefix`);--> statement-breakpoint
CREATE TABLE `interaction` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`requester_token_id` text NOT NULL,
	`title` text NOT NULL,
	`prompt` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`choices` text NOT NULL,
	`response` text,
	`url` text,
	`action_digest` text NOT NULL,
	`idempotency_key` text,
	`request_hash` text,
	`accepted_count` integer DEFAULT 0 NOT NULL,
	`responding_device_id` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`responded_at` integer,
	`canceled_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requester_token_id`) REFERENCES `api_token`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`responding_device_id`) REFERENCES `device`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `interaction_token_idempotency_unique` ON `interaction` (`requester_token_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `interaction_token_created_at_idx` ON `interaction` (`requester_token_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `interaction_user_status_expiry_idx` ON `interaction` (`user_id`,`status`,`expires_at`);