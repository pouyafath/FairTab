import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import type { Expense, Group, Member, Profile, RecurringExpense } from '@/lib/types';

const EXPENSE_COLUMNS = '*, expense_shares(member_id, paid, owed)';
const PAGE = 1000; // Supabase returns at most 1000 rows per request by default.

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: Error | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

function check<T>({ data, error }: { data: T; error: Error | null }): T {
  if (error) throw error;
  return data;
}

export const keys = {
  profile: ['profile'] as const,
  groups: ['groups'] as const,
  members: ['members'] as const,
  profiles: ['profiles'] as const,
  expenses: ['expenses'] as const,
  recurring: ['recurring'] as const,
};

export function useProfile(userId: string) {
  return useQuery({
    queryKey: keys.profile,
    enabled: !!userId,
    queryFn: async () =>
      check(await supabase.from('profiles').select('*').eq('id', userId).single()) as Profile,
  });
}

export function useGroups() {
  return useQuery({
    queryKey: keys.groups,
    queryFn: async () =>
      check(await supabase.from('groups').select('*').order('created_at', { ascending: false })) as Group[],
  });
}

/** Members of every group I belong to (row level security filters the rest). */
export function useMembers() {
  return useQuery({
    queryKey: keys.members,
    queryFn: () =>
      fetchAll<Member>((from, to) => supabase.from('group_members').select('*').order('created_at').order('id').range(from, to)),
  });
}

/** Display names of everyone I share a group with, keyed by user id. */
export function useProfileNames() {
  return useQuery({
    queryKey: keys.profiles,
    queryFn: async () => {
      const rows = check(await supabase.from('profiles').select('id, display_name')) as Pick<Profile, 'id' | 'display_name'>[];
      return Object.fromEntries(rows.map((p) => [p.id, p.display_name])) as Record<string, string>;
    },
  });
}

/** All non-deleted expenses in all my groups, newest first. */
export function useExpenses() {
  return useQuery({
    queryKey: keys.expenses,
    queryFn: () =>
      fetchAll<Expense>((from, to) =>
        supabase
          .from('expenses')
          .select(EXPENSE_COLUMNS)
          .is('deleted_at', null)
          .order('spent_on', { ascending: false })
          .order('created_at', { ascending: false })
          // Unique tie-breaker: without it, paging can repeat or skip rows that share a timestamp
          // (an import saves thousands of rows with the same created_at).
          .order('id')
          .range(from, to),
      ),
  });
}

/** Recurring expenses (rent, subscriptions) in all my groups, next date first. */
export function useRecurringExpenses() {
  return useQuery({
    queryKey: keys.recurring,
    queryFn: async () =>
      check(await supabase.from('recurring_expenses').select('*').order('next_on').order('id')) as RecurringExpense[],
  });
}

/** Refetch everything after a change. Data is small, so this keeps things simple and correct. */
export function useInvalidateAll() {
  const client = useQueryClient();
  return () => client.invalidateQueries();
}

function useRpc<A extends Record<string, unknown>, R = unknown>(fn: string) {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (args: A) => check(await supabase.rpc(fn, args)) as R,
    // Don't wait for the refetch: callers navigate away in their own onSuccess, and waiting
    // could leave them on a screen whose data no longer exists (e.g. after leaving a group).
    onSuccess: () => {
      void invalidate();
    },
  });
}

export interface SaveExpenseArgs extends Record<string, unknown> {
  p_group_id: string;
  p_description: string;
  p_amount: number;
  p_currency: string;
  p_shares: { member_id: string; paid: number; owed: number }[];
  p_kind?: 'expense' | 'payment';
  p_category?: string | null;
  p_spent_on?: string | null;
  p_expense_id?: string | null;
  p_notes?: string | null;
}

export const useSaveExpense = () => useRpc<SaveExpenseArgs, string>('save_expense');
export const useDeleteExpense = () => useRpc<{ p_expense_id: string }>('delete_expense');
export const useCreateGroup = () => useRpc<{ p_name: string; p_currency: string }, string>('create_group');
export const useJoinGroup = () => useRpc<{ p_code: string; p_claim_member_id: string | null }, string>('join_group');
export const useLeaveGroup = () => useRpc<{ p_group_id: string }>('leave_group');
export const useDeleteGroup = () => useRpc<{ p_group_id: string }>('delete_group');
export const useRemoveMember = () => useRpc<{ p_member_id: string }>('remove_member');
export const useRegenerateInvite = () => useRpc<{ p_group_id: string }, string>('regenerate_invite');
export const useImportMore = () => useRpc<{ p_group_id: string; p_entries: unknown[] }>('import_more');
export const useImportGroup = () =>
  useRpc<{ p_name: string; p_currency: string; p_members: string[]; p_me: string | null; p_entries: unknown[] }, string>(
    'import_group',
  );

/**
 * An expense plus a schedule. p_start_on is the first date (today when left out). p_today is the
 * device's date, so "today" means the same day here and in the database (which uses UTC).
 */
export interface CreateRecurringArgs extends Record<string, unknown> {
  p_group_id: string;
  p_description: string;
  p_amount: number;
  p_currency: string;
  p_shares: { member_id: string; paid: number; owed: number }[];
  p_frequency: 'weekly' | 'monthly' | 'yearly';
  p_interval?: number;
  p_start_on?: string | null;
  p_end_on?: string | null;
  p_category?: string | null;
  p_notes?: string | null;
  p_today?: string | null;
}

export const useCreateRecurring = () => useRpc<CreateRecurringArgs, string>('create_recurring');
export const useSetRecurringPaused = () => useRpc<{ p_recurring_id: string; p_paused: boolean }>('set_recurring_paused');
export const useDeleteRecurring = () => useRpc<{ p_recurring_id: string }>('delete_recurring');

export function useUpdate<T extends Record<string, unknown>>(table: 'groups' | 'group_members' | 'profiles') {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: T }) => {
      check(await supabase.from(table).update(values as never).eq('id', id));
    },
    onSuccess: () => {
      void invalidate();
    },
  });
}

export function useAddGuest() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: async (args: { group_id: string; display_name: string }) => {
      check(await supabase.from('group_members').insert(args));
    },
    onSuccess: () => {
      void invalidate();
    },
  });
}

/** Turns Supabase/Postgres errors into a sentence to show the user. */
export function errorMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
  return String(error);
}
