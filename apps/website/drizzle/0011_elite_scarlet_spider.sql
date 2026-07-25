PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_interaction` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`requester_token_id` text,
	`requester_service_id` text,
	`event_id` text,
	`title` text NOT NULL,
	`prompt` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`choices` text NOT NULL,
	`response` text,
	`url` text,
	`image_url` text,
	`correlation_id` text,
	`action_digest` text NOT NULL,
	`idempotency_key` text,
	`request_hash` text,
	`response_token_hash` text,
	`callback_url` text,
	`callback_token_ciphertext` text,
	`callback_status` text,
	`callback_attempts` integer DEFAULT 0 NOT NULL,
	`callback_next_attempt_at` integer,
	`callback_last_error` text,
	`callback_delivered_at` integer,
	`accepted_count` integer DEFAULT 0 NOT NULL,
	`responding_device_id` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`responded_at` integer,
	`canceled_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requester_token_id`) REFERENCES `api_token`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requester_service_id`) REFERENCES `service`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `event`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`responding_device_id`) REFERENCES `device`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "interaction_requester_check" CHECK(("requester_token_id" is not null) != ("requester_service_id" is not null))
);
--> statement-breakpoint
INSERT INTO `__new_interaction`("id", "user_id", "requester_token_id", "requester_service_id", "event_id", "title", "prompt", "kind", "status", "choices", "response", "url", "image_url", "correlation_id", "action_digest", "idempotency_key", "request_hash", "response_token_hash", "callback_url", "callback_token_ciphertext", "callback_status", "callback_attempts", "callback_next_attempt_at", "callback_last_error", "callback_delivered_at", "accepted_count", "responding_device_id", "expires_at", "created_at", "responded_at", "canceled_at") SELECT "id", "user_id", "requester_token_id", NULL, NULL, "title", "prompt", "kind", "status", "choices", "response", "url", NULL, NULL, "action_digest", "idempotency_key", "request_hash", NULL, NULL, NULL, NULL, 0, NULL, NULL, NULL, "accepted_count", "responding_device_id", "expires_at", "created_at", "responded_at", "canceled_at" FROM `interaction`;--> statement-breakpoint
DROP TABLE `interaction`;--> statement-breakpoint
ALTER TABLE `__new_interaction` RENAME TO `interaction`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `interaction_token_idempotency_unique` ON `interaction` (`requester_token_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `interaction_token_created_at_idx` ON `interaction` (`requester_token_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `interaction_service_idempotency_unique` ON `interaction` (`requester_service_id`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `interaction_event_unique` ON `interaction` (`event_id`);--> statement-breakpoint
CREATE INDEX `interaction_service_created_at_idx` ON `interaction` (`requester_service_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `interaction_callback_due_idx` ON `interaction` (`callback_status`,`callback_next_attempt_at`);--> statement-breakpoint
CREATE INDEX `interaction_user_status_expiry_idx` ON `interaction` (`user_id`,`status`,`expires_at`);--> statement-breakpoint
ALTER TABLE `device` ADD `interaction_schema_version` integer;
