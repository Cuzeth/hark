DROP INDEX `live_activity_token_key_unique`;--> statement-breakpoint
DROP INDEX `live_activity_service_key_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `live_activity_token_key_unique` ON `live_activity` (`requester_token_id`,`key`) WHERE "live_activity"."status" in ('starting', 'active', 'partial');--> statement-breakpoint
CREATE UNIQUE INDEX `live_activity_service_key_unique` ON `live_activity` (`requester_service_id`,`key`) WHERE "live_activity"."status" in ('starting', 'active', 'partial');