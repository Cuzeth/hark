ALTER TABLE `user` ADD `welcome_notification_sent_at` integer;
--> statement-breakpoint
UPDATE `user`
SET `welcome_notification_sent_at` = CAST(strftime('%s', 'now') AS integer) * 1000;
