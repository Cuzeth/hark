DROP INDEX `device_expo_push_token_unique`;--> statement-breakpoint
ALTER TABLE `device` DROP COLUMN `expo_push_token`;--> statement-breakpoint
ALTER TABLE `device` DROP COLUMN `apns_token`;--> statement-breakpoint
ALTER TABLE `device` ADD `token` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `device_token_unique` ON `device` (`token`);