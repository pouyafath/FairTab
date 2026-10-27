import { router } from 'expo-router';
import { View } from 'react-native';

import { ArchivedGroups } from '@/components/archived-groups';
import { BalanceText, Button, Empty, ErrorText, ListRow, Loading, Screen, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useUserId } from '@/lib/auth';
import { myNet } from '@/lib/ledger';
import { useExpenses, useGroups, useInvalidateAll, useMembers } from '@/lib/queries';

export default function Groups() {
  const userId = useUserId();
  const groups = useGroups();
  const members = useMembers();
  const expenses = useExpenses();
  const refresh = useInvalidateAll();

  const loading = groups.isPending || members.isPending || expenses.isPending;
  const error = groups.error ?? members.error ?? expenses.error;

  return (
    <Screen refreshing={groups.isRefetching} onRefresh={refresh}>
      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
        <View style={{ flex: 1 }}>
          <Button title="New group" onPress={() => router.push('/new-group')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Import from Splitwise" variant="secondary" onPress={() => router.push('/import')} />
        </View>
      </View>
      <ErrorText error={error} />
      {loading ? (
        <Loading />
      ) : groups.data?.length === 0 ? (
        <Empty title="No groups yet">
          <T muted style={{ textAlign: 'center' }}>
            Create a group for your flat, a trip or a couple, or bring your groups over from Splitwise.
          </T>
        </Empty>
      ) : (
        <View>
          {groups.data?.filter((g) => !g.archived_at).map((group) => {
            const me = members.data?.find((m) => m.group_id === group.id && m.user_id === userId);
            const count = members.data?.filter((m) => m.group_id === group.id && !m.left_at).length ?? 0;
            const net = myNet(me?.id, expenses.data?.filter((e) => e.group_id === group.id) ?? []);
            return (
              <ListRow
                key={group.id}
                title={group.name}
                subtitle={`${count} ${count === 1 ? 'person' : 'people'}`}
                right={<BalanceText amounts={net} mode="self" />}
                onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}
              />
            );
          })}
          <ArchivedGroups groups={groups.data?.filter((g) => !!g.archived_at) ?? []} />
        </View>
      )}
    </Screen>
  );
}
