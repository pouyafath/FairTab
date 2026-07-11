CREATE INDEX IF NOT EXISTS `recurring_rules_active_next_run_idx`
  ON `recurring_rules` (`active`, `next_run_date`);
