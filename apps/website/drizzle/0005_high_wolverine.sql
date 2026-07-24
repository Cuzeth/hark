CREATE TABLE `device_authorization_request` (
	`id` text PRIMARY KEY NOT NULL,
	`device_code_hash` text NOT NULL,
	`user_code` text NOT NULL,
	`client_name` text NOT NULL,
	`requested_scopes` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`approved_user_id` text,
	`expires_at` integer NOT NULL,
	`token_expires_at` integer NOT NULL,
	`poll_interval_seconds` integer NOT NULL,
	`last_poll_at` integer,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	`consumed_at` integer,
	FOREIGN KEY (`approved_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `device_authorization_device_code_hash_unique` ON `device_authorization_request` (`device_code_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `device_authorization_user_code_unique` ON `device_authorization_request` (`user_code`);--> statement-breakpoint
CREATE INDEX `device_authorization_status_expiry_idx` ON `device_authorization_request` (`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `device_authorization_approved_user_idx` ON `device_authorization_request` (`approved_user_id`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_interaction` (
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
	FOREIGN KEY (`requester_token_id`) REFERENCES `api_token`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`responding_device_id`) REFERENCES `device`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_interaction`("id", "user_id", "requester_token_id", "title", "prompt", "kind", "status", "choices", "response", "url", "action_digest", "idempotency_key", "request_hash", "accepted_count", "responding_device_id", "expires_at", "created_at", "responded_at", "canceled_at") SELECT "id", "user_id", "requester_token_id", "title", "prompt", "kind", "status", "choices", "response", "url", "action_digest", "idempotency_key", "request_hash", "accepted_count", "responding_device_id", "expires_at", "created_at", "responded_at", "canceled_at" FROM `interaction`;--> statement-breakpoint
DROP TABLE `interaction`;--> statement-breakpoint
ALTER TABLE `__new_interaction` RENAME TO `interaction`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `interaction_token_idempotency_unique` ON `interaction` (`requester_token_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `interaction_token_created_at_idx` ON `interaction` (`requester_token_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `interaction_user_status_expiry_idx` ON `interaction` (`user_id`,`status`,`expires_at`);