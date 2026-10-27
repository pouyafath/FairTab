import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { BalanceText, ListRow, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useUserId } from '@/lib/auth';
import { myNet } from '@/lib/ledger';
import { useExpenses, useMembers } from '@/lib/queries';
import type { Group } from '@/lib/types';

/** Archived groups, at the bottom of the groups list. Closed until tapped. */
export function ArchivedGroups({ groups }: { groups: Group[] }) {
  const userId = useUserId();
  const members = useMembers();
  const expenses = useExpenses();
  const [open, setOpen] = useState(false);
  if (groups.length === 0) return null;

  return (
    <View style={{ marginTop: Spacing.four }}>
      <ListRow
        title={`Archived (${groups.length})`}
        subtitle={open ? 'Tap to hide' : 'Tap to show'}
        right={<T muted>{open ? '▲' : '▼'}</T>}
        onPress={() => setOpen((o) => !o)}
      />
      {open
        ? groups.map((group) => {
            const me = members.data?.find((m) => m.group_id === group.id && m.user_id === userId);
            const net = myNet(me?.id, expenses.data?.filter((e) => e.group_id === group.id) ?? []);
            return (
              <ListRow
                key={group.id}
                title={group.name}
                subtitle="Archived (read-only)"
                right={<BalanceText amounts={net} mode="self" />}
                onPress={() => router.push({ pathname: '/group/[id]', params: { id: group.id } })}
              />
            );
          })
        : null}
    </View>
  );
}
