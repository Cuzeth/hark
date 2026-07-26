CREATE TABLE `apple_native_grant` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`apple_subject` text NOT NULL,
	`client_id` text NOT NULL,
	`refresh_token_ciphertext` text NOT NULL,
	`authorization_code_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `apple_native_grant_user_unique` ON `apple_native_grant` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `apple_native_grant_code_hash_unique` ON `apple_native_grant` (`authorization_code_hash`);--> statement-breakpoint
CREATE INDEX `apple_native_grant_subject_idx` ON `apple_native_grant` (`apple_subject`);