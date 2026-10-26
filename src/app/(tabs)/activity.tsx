import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ExpenseRow } from '@/components/expense-row';
import { Button, Empty, ErrorText, Loading, Screen } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { useExpenses, useGroups, useInvalidateAll, useMembers, useProfileNames } from '@/lib/queries';

const PAGE = 50;

export default function Activity() {
  const userId = useUserId();
  const groups = useGroups();
  const members = useMembers();
  const expenses = useExpenses();
  const refresh = useInvalidateAll();
  const [limit, setLimit] = useState(PAGE);

  const loading = groups.isPending || members.isPending || expenses.isPending;
  const names = useProfileNames();
  // Show people with an account under their current profile name, like the group screen does.
  const membersById = new Map(
    (members.data ?? []).map((m) => [m.id, { ...m, display_name: (m.user_id && names.data?.[m.user_id]) || m.display_name }]),
  );
  const groupNames = new Map((groups.data ?? []).map((g) => [g.id, g.name]));
  const myMemberIds = new Map(
    (members.data ?? []).filter((m) => m.user_id === userId).map((m) => [m.group_id, m.id]),
  );
  const sorted = [...(expenses.data ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <Screen refreshing={expenses.isRefetching} onRefresh={refresh}>
      <ErrorText error={groups.error ?? members.error ?? expenses.error} />
      {loading ? (
        <Loading />
      ) : sorted.length === 0 ? (
        <Empty title="Nothing here yet" />
      ) : (
        <View>
          {sorted.slice(0, limit).map((e) => (
            <ExpenseRow
              key={e.id}
              expense={e}
              members={membersById}
              myMemberId={myMemberIds.get(e.group_id)}
              groupName={groupNames.get(e.group_id)}
              onPress={() =>
                router.push(
                  e.kind === 'payment'
                    ? { pathname: '/group/[id]/settle', params: { id: e.group_id, expenseId: e.id } }
                    : { pathname: '/group/[id]/expense', params: { id: e.group_id, expenseId: e.id } },
                )
              }
            />
          ))}
          {sorted.length > limit ? <Button title="Show more" variant="secondary" onPress={() => setLimit(limit + PAGE)} /> : null}
        </View>
      )}
    </Screen>
  );
}
