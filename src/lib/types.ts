export interface Profile {
  id: string;
  display_name: string;
  default_currency: string;
}

export interface Group {
  id: string;
  name: string;
  default_currency: string;
  simplify_debts: boolean;
  invite_code: string;
  created_by: string | null;
  created_at: string;
  /** Set while the group is archived (read-only). Missing until the archive database update is run. */
  archived_at?: string | null;
}

export interface Member {
  id: string;
  group_id: string;
  user_id: string | null;
  display_name: string;
  /** Set when the person left or was removed; kept so the group's history still adds up. */
  left_at: string | null;
}

export interface ShareRow {
  member_id: string;
  paid: number;
  owed: number;
}

export interface Expense {
  id: string;
  group_id: string;
  kind: 'expense' | 'payment';
  description: string;
  category: string | null;
  notes: string | null;
  amount: number;
  currency: string;
  spent_on: string;
  created_by: string | null;
  created_at: string;
  /** Set when a recurring expense added this one. */
  recurring_id?: string | null;
  expense_shares: ShareRow[];
}

/** An expense or payment someone deleted; it can be restored from "Recently deleted". */
export type DeletedExpense = Expense & { deleted_at: string };

/** A rule that adds the same expense on a schedule (rent, subscriptions). */
export interface RecurringExpense {
  id: string;
  group_id: string;
  description: string;
  category: string | null;
  notes: string | null;
  amount: number;
  currency: string;
  shares: ShareRow[];
  frequency: 'weekly' | 'monthly' | 'yearly';
  interval_count: number;
  anchor_day: number | null;
  start_on: string;
  /** The next date whose expense has not been added yet. */
  next_on: string;
  end_on: string | null;
  paused: boolean;
  created_by: string | null;
  created_at: string;
}
