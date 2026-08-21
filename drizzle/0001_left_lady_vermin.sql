DROP INDEX `note_userId_idx`;--> statement-breakpoint
ALTER TABLE `note` ADD `updatedAt` integer DEFAULT (unixepoch()) NOT NULL;--> statement-breakpoint
CREATE INDEX `note_userId_createdAt_idx` ON `note` (`userId`,`createdAt`);