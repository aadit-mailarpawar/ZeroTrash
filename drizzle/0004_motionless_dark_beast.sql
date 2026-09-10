ALTER TABLE `credit_ledger` ADD `report_id` integer REFERENCES reports(id);--> statement-breakpoint
CREATE UNIQUE INDEX `credit_ledger_cleanup_report_unique` ON `credit_ledger` (`report_id`) WHERE "credit_ledger"."kind" = 'cleanup' AND "credit_ledger"."report_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE `reports` ADD `verified_by` text;--> statement-breakpoint
ALTER TABLE `reports` ADD `verified_at` text;