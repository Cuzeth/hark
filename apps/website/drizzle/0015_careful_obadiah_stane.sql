ALTER TABLE `live_activity_operation` ADD `props` text;--> statement-breakpoint
CREATE INDEX `agent_notification_user_created_at_idx` ON `agent_notification` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `interaction_user_responded_at_idx` ON `interaction` (`user_id`,`responded_at`);