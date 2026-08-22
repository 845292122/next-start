ALTER TABLE `user` ADD `openid` text;--> statement-breakpoint
CREATE UNIQUE INDEX `user_openid_unique` ON `user` (`openid`);