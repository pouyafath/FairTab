import { router } from 'expo-router';
import { View } from 'react-native';

import { BalanceText, Card, Empty, ErrorText, ListRow, Loading, Screen, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useUserId } from '@/lib/auth';
import { addAmount, friendBalances, type Amounts } from '@/lib/ledger';
import { useExpenses, useGroups, useInvalidateAll, useMembers, useProfileNames } from '@/lib/queries';

export default function Friends() {
  const userId = useUserId();
  const groups = useGroups();
  const members = useMembers();
  const expenses = useExpenses();
  const names = useProfileNames();
  const refresh = useInvalidateAll();

  const queries = [groups, members, expenses, names];
  const loading = queries.some((q) => q.isPending);
  const error = queries.find((q) => q.error)?.error;

  const friends = loading
    ? []
    : friendBalances(userId, groups.data ?? [], members.data ?? [], expenses.data ?? [], names.data ?? {});
  const overall: Amounts = {};
  for (const f of friends) for (const [c, v] of Object.entries(f.total)) addAmount(overall, c, v);

  return (
    <Screen refreshing={expenses.isRefetching} onRefresh={refresh}>
      <ErrorText error={error} />
      {loading ? (
        <Loading />
      ) : (
        <>
          <Card>
            <T variant="label" muted>Overall</T>
            <BalanceText amounts={overall} align="left" mode="self" />
          </Card>
          {friends.length === 0 ? (
            <Empty title="You are all settled up" />
          ) : (
            <View>
              {friends.map((f) => (
                <View key={f.key}>
                  <ListRow title={f.name} right={<BalanceText amounts={f.total} />} />
                  <View style={{ paddingLeft: Spacing.three }}>
                    {f.byGroup.map(({ group, amounts }) => (
                      <ListRow
                        key={group.id}
                        title={group.name}
                        right={<BalanceText amounts={amounts} />}
                        onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
