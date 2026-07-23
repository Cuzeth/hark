ALTER TABLE `event` ADD `error` text;--> statement-breakpoint
ALTER TABLE `event` ADD `idempotency_key` text;--> statement-breakpoint
ALTER TABLE `event` ADD `request_hash` text;--> statement-breakpoint
CREATE UNIQUE INDEX `event_service_idempotency_key_unique` ON `event` (`service_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `event_service_created_at_idx` ON `event` (`service_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `service_user_id_idx` ON `service` (`user_id`);