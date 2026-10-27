CREATE TABLE `savings_goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`target_amount` integer NOT NULL,
	`current_amount` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'CAD' NOT NULL,
	`target_date` integer,
	`created_at` integer NOT NULL
);
