DROP INDEX `live_activity_delivery_one_active_per_device_unique`;--> statement-breakpoint
ALTER TABLE `device` ADD `live_activity_interaction_version` integer;--> statement-breakpoint
ALTER TABLE `interaction` ADD `presentation` text DEFAULT 'notification' NOT NULL;--> statement-breakpoint
ALTER TABLE `interaction` ADD `primary_label` text;--> statement-breakpoint
ALTER TABLE `interaction` ADD `secondary_label` text;--> statement-breakpoint
ALTER TABLE `live_activity` ADD `interaction_id` text REFERENCES interaction(id);--> statement-breakpoint
CREATE UNIQUE INDEX `live_activity_interaction_id_unique` ON `live_activity` (`interaction_id`);