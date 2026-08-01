ALTER TABLE `agent_notification` ADD `priority` text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `event` ADD `priority` text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `service` ADD `priority` text DEFAULT 'normal' NOT NULL;