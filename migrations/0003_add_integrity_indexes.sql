CREATE INDEX IF NOT EXISTS `group_members_group_id_idx`
  ON `group_members` (`group_id`);

CREATE INDEX IF NOT EXISTS `expenses_group_id_date_idx`
  ON `expenses` (`group_id`, `date`);

CREATE INDEX IF NOT EXISTS `expenses_paid_by_id_idx`
  ON `expenses` (`paid_by_id`);

CREATE UNIQUE INDEX IF NOT EXISTS `expense_participants_expense_member_unique`
  ON `expense_participants` (`expense_id`, `member_id`);

CREATE INDEX IF NOT EXISTS `expense_participants_member_id_idx`
  ON `expense_participants` (`member_id`);

CREATE INDEX IF NOT EXISTS `settlements_group_id_paid_idx`
  ON `settlements` (`group_id`, `is_paid`, `paid_at`);

CREATE INDEX IF NOT EXISTS `personal_transactions_date_idx`
  ON `personal_transactions` (`date`);
