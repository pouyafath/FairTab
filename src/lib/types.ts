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
  expense_shares: ShareRow[];
}

/** An expense or payment someone deleted; it can be restored from "Recently deleted". */
export type DeletedExpense = Expense & { deleted_at: string };
