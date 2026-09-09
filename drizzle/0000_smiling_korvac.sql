CREATE TABLE `credit_ledger` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`amount` integer NOT NULL,
	`kind` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `redemptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reward_id` text NOT NULL,
	`reward_name` text NOT NULL,
	`credits` integer NOT NULL,
	`code` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`volunteer` text DEFAULT 'Samira Khan' NOT NULL,
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
