PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`volunteer` text DEFAULT 'Volunteer' NOT NULL,
	`volunteer_email` text DEFAULT '' NOT NULL,
	`location` text NOT NULL,
	`waste_type` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`before_key` text NOT NULL,
	`after_key` text,
	`center` text,
	`weight` real,
	`credits` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'awaiting_cleanup' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_reports`("id", "volunteer", "volunteer_email", "location", "waste_type", "notes", "before_key", "after_key", "center", "weight", "credits", "status", "created_at") SELECT "id", "volunteer", '', "location", "waste_type", "notes", "before_key", "after_key", "center", "weight", "credits", "status", "created_at" FROM `reports`;--> statement-breakpoint
DROP TABLE `reports`;--> statement-breakpoint
ALTER TABLE `__new_reports` RENAME TO `reports`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `credit_ledger` ADD `volunteer_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `redemptions` ADD `volunteer_email` text DEFAULT '' NOT NULL;
