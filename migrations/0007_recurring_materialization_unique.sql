CREATE UNIQUE INDEX IF NOT EXISTS `personal_transactions_source_rule_date_unique`
  ON `personal_transactions` (`source_rule_id`, `date`);
