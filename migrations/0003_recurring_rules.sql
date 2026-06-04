CREATE TABLE `recurring_rules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'CAD' NOT NULL,
	`category` text,
	`note` text,
	`account_label` text,
	`frequency` text NOT NULL,
	`interval_count` integer DEFAULT 1 NOT NULL,
	`next_run_date` integer NOT NULL,
	`last_run_date` integer,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);

ALTER TABLE `personal_transactions` ADD COLUMN `source_rule_id` integer;
