import { useUserId } from '@/lib/auth';
import { useExpenses, useGroups, useMembers, useProfileNames } from '@/lib/queries';
import type { Member } from '@/lib/types';

/** Everything a group screen needs, with linked members shown under their current profile name. */
export function useGroup(groupId: string) {
  const userId = useUserId();
  const groups = useGroups();
  const membersQuery = useMembers();
  const expensesQuery = useExpenses();
  const names = useProfileNames();

  const queries = [groups, membersQuery, expensesQuery, names];
  const group = groups.data?.find((g) => g.id === groupId);
  const members: Member[] = (membersQuery.data ?? [])
    .filter((m) => m.group_id === groupId)
    .map((m) => ({ ...m, display_name: (m.user_id && names.data?.[m.user_id]) || m.display_name }));
  const me = members.find((m) => m.user_id === userId);
  // People who left are kept for history but cannot be added to new expenses.
  const activeMembers = members.filter((m) => !m.left_at);

  return {
    loading: queries.some((q) => q.isPending),
    error: queries.find((q) => q.error)?.error ?? null,
    refreshing: expensesQuery.isRefetching,
    group,
    members,
    activeMembers,
    membersById: new Map(members.map((m) => [m.id, m])),
    me,
    expenses: (expensesQuery.data ?? []).filter((e) => e.group_id === groupId),
  };
}
