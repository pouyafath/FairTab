ALTER TABLE `recurring_rules` ADD COLUMN `anchor_day` integer;

UPDATE `recurring_rules`
  SET `anchor_day` = CAST(strftime('%d', `next_run_date` / 1000, 'unixepoch') AS INTEGER)
  WHERE `anchor_day` IS NULL;
