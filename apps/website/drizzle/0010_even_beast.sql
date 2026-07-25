PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_live_activity` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`requester_token_id` text,
	`requester_service_id` text,
	`key` text,
	`schema_version` integer NOT NULL,
	`props` text NOT NULL,
	`status` text DEFAULT 'starting' NOT NULL,
	`sequence` integer DEFAULT 0 NOT NULL,
	`apns_timestamp` integer DEFAULT 0 NOT NULL,
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
	FOREIGN KEY (`requester_token_id`) REFERENCES `api_token`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requester_service_id`) REFERENCES `service`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "live_activity_requester_check" CHECK(("requester_token_id" is not null) != ("requester_service_id" is not null))
);
--> statement-breakpoint
INSERT INTO `__new_live_activity`("id", "user_id", "requester_token_id", "requester_service_id", "key", "schema_version", "props", "status", "sequence", "apns_timestamp", "accepted_count", "failed_count", "idempotency_key", "request_hash", "expires_at", "stale_at", "dismissal_at", "created_at", "updated_at", "ended_at") SELECT "id", "user_id", "requester_token_id", NULL, "key", "schema_version", "props", "status", "sequence", "apns_timestamp", "accepted_count", "failed_count", "idempotency_key", "request_hash", "expires_at", "stale_at", "dismissal_at", "created_at", "updated_at", "ended_at" FROM `live_activity`;--> statement-breakpoint
DROP TABLE `live_activity`;--> statement-breakpoint
ALTER TABLE `__new_live_activity` RENAME TO `live_activity`;--> statement-breakpoint
CREATE UNIQUE INDEX `live_activity_token_idempotency_unique` ON `live_activity` (`requester_token_id`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `live_activity_service_idempotency_unique` ON `live_activity` (`requester_service_id`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `live_activity_token_key_unique` ON `live_activity` (`requester_token_id`,`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `live_activity_service_key_unique` ON `live_activity` (`requester_service_id`,`key`);--> statement-breakpoint
CREATE INDEX `live_activity_user_status_updated_idx` ON `live_activity` (`user_id`,`status`,`updated_at`);--> statement-breakpoint
CREATE INDEX `live_activity_token_created_idx` ON `live_activity` (`requester_token_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `live_activity_service_created_idx` ON `live_activity` (`requester_service_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `__new_live_activity_delivery_attempt` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`delivery_id` text NOT NULL,
	`operation_id` text NOT NULL,
	`requester_token_id` text,
	`requester_service_id` text,
	`event` text NOT NULL,
	`sequence` integer NOT NULL,
	`apns_status` integer,
	`apns_reason` text,
	`apns_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `live_activity`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`delivery_id`) REFERENCES `live_activity_delivery`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`operation_id`) REFERENCES `live_activity_operation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requester_token_id`) REFERENCES `api_token`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requester_service_id`) REFERENCES `service`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "live_activity_attempt_requester_check" CHECK(("requester_token_id" is not null) != ("requester_service_id" is not null))
);
--> statement-breakpoint
INSERT INTO `__new_live_activity_delivery_attempt`("id", "activity_id", "delivery_id", "operation_id", "requester_token_id", "requester_service_id", "event", "sequence", "apns_status", "apns_reason", "apns_id", "created_at") SELECT "id", "activity_id", "delivery_id", "operation_id", "requester_token_id", NULL, "event", "sequence", "apns_status", "apns_reason", "apns_id", "created_at" FROM `live_activity_delivery_attempt`;--> statement-breakpoint
DROP TABLE `live_activity_delivery_attempt`;--> statement-breakpoint
ALTER TABLE `__new_live_activity_delivery_attempt` RENAME TO `live_activity_delivery_attempt`;--> statement-breakpoint
CREATE INDEX `live_activity_attempt_token_created_idx` ON `live_activity_delivery_attempt` (`requester_token_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `live_activity_attempt_activity_created_idx` ON `live_activity_delivery_attempt` (`activity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `__new_live_activity_operation` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`requester_token_id` text,
	`requester_service_id` text,
	`event` text NOT NULL,
	`sequence` integer NOT NULL,
	`idempotency_key` text,
	`request_hash` text,
	`accepted_count` integer DEFAULT 0 NOT NULL,
	`failed_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `live_activity`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requester_token_id`) REFERENCES `api_token`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`requester_service_id`) REFERENCES `service`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "live_activity_operation_requester_check" CHECK(("requester_token_id" is not null) != ("requester_service_id" is not null))
);
--> statement-breakpoint
INSERT INTO `__new_live_activity_operation`("id", "activity_id", "requester_token_id", "requester_service_id", "event", "sequence", "idempotency_key", "request_hash", "accepted_count", "failed_count", "created_at") SELECT "id", "activity_id", "requester_token_id", NULL, "event", "sequence", "idempotency_key", "request_hash", "accepted_count", "failed_count", "created_at" FROM `live_activity_operation`;--> statement-breakpoint
DROP TABLE `live_activity_operation`;--> statement-breakpoint
ALTER TABLE `__new_live_activity_operation` RENAME TO `live_activity_operation`;--> statement-breakpoint
CREATE UNIQUE INDEX `live_activity_operation_token_idempotency_unique` ON `live_activity_operation` (`requester_token_id`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `live_activity_operation_service_idempotency_unique` ON `live_activity_operation` (`requester_service_id`,`idempotency_key`);--> statement-breakpoint
CREATE INDEX `live_activity_operation_token_created_idx` ON `live_activity_operation` (`requester_token_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `live_activity_operation_service_created_idx` ON `live_activity_operation` (`requester_service_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `live_activity_operation_activity_created_idx` ON `live_activity_operation` (`activity_id`,`created_at`);--> statement-breakpoint
PRAGMA foreign_key_check;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
UPDATE `live_activity_delivery` AS `delivery`
SET `status` = 'ended', `ended_at` = coalesce(`ended_at`, unixepoch() * 1000), `updated_at` = unixepoch() * 1000
WHERE `status` in ('pending', 'accepted', 'active')
  AND EXISTS (
    SELECT 1 FROM `live_activity_delivery` AS `newer`
    WHERE `newer`.`device_id` = `delivery`.`device_id`
      AND `newer`.`status` in ('pending', 'accepted', 'active')
      AND (`newer`.`created_at` > `delivery`.`created_at`
        OR (`newer`.`created_at` = `delivery`.`created_at` AND `newer`.`id` > `delivery`.`id`))
  );--> statement-breakpoint
CREATE UNIQUE INDEX `live_activity_delivery_one_active_per_device_unique` ON `live_activity_delivery` (`device_id`) WHERE "live_activity_delivery"."status" in ('pending', 'accepted', 'active');
