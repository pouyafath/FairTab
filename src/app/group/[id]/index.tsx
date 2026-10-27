import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ExpenseFilters } from '@/components/expense-filters';
import { ExpenseRow } from '@/components/expense-row';
import { ExportCsvButton } from '@/components/export-button';
import { BalanceText, Button, Card, Empty, ErrorText, ListRow, Loading, Screen, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { formatMoney, netBalances } from '@/domain';
import { filterExpenses, NO_FILTER } from '@/lib/filters';
import { groupTransfers, toLedger, type Amounts } from '@/lib/ledger';
import { useInvalidateAll } from '@/lib/queries';
import { useGroup } from '@/lib/use-group';

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, error, refreshing, group, members, membersById, me, expenses } = useGroup(id);
  const refresh = useInvalidateAll();
  const [filter, setFilter] = useState(NO_FILTER);

  if (loading) return <Loading />;
  if (!group) {
    return (
      <Screen>
        <ErrorText error={error ?? 'This group does not exist or you are no longer a member.'} />
      </Screen>
    );
  }

  const nets = netBalances(toLedger(expenses));
  const memberAmounts = (memberId: string): Amounts => {
    const result: Amounts = {};
    for (const [currency, byMember] of nets) {
      const v = byMember.get(memberId);
      if (v) result[currency] = v;
    }
    return result;
  };
  const transfers = groupTransfers(group, expenses);
  const name = (memberId: string) => (memberId === me?.id ? 'You' : membersById.get(memberId)?.display_name ?? '?');
  // Balances above always use every expense; the search and filters only narrow the list below.
  const shown = filterExpenses(expenses, filter);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Stack.Screen options={{ title: group.name }} />
      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
        <View style={{ flex: 1 }}>
          <Button title="Add expense" onPress={() => router.push({ pathname: '/group/[id]/expense', params: { id } })} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Settle up" variant="secondary" onPress={() => router.push({ pathname: '/group/[id]/settle', params: { id } })} />
        </View>
      </View>
      <ErrorText error={error} />

      <Card>
        <T variant="label" muted>Balances</T>
        {members
          .filter((m) => !m.left_at || Object.keys(memberAmounts(m.id)).length > 0)
          .map((m) => (
            <ListRow
              key={m.id}
              title={m.id === me?.id ? `${m.display_name} (you)` : m.display_name}
              subtitle={m.left_at ? 'left the group' : m.user_id ? undefined : 'not joined yet'}
              right={<BalanceText amounts={memberAmounts(m.id)} mode="member" />}
            />
          ))}
      </Card>

      {transfers.length > 0 ? (
        <Card>
          <T variant="label" muted>{group.simplify_debts ? 'Suggested payments' : 'Who owes whom'}</T>
          {transfers.map((t) => (
            <ListRow
              key={`${t.from}-${t.to}-${t.currency}`}
              title={`${name(t.from)} → ${name(t.to)}`}
              right={<T style={{ fontWeight: '700' }}>{formatMoney(t.amount, t.currency)}</T>}
              onPress={() =>
                router.push({
                  pathname: '/group/[id]/settle',
                  params: { id, from: t.from, to: t.to, amount: String(t.amount), currency: t.currency },
                })
              }
            />
          ))}
        </Card>
      ) : null}

      <T variant="label" muted>Expenses</T>
      {expenses.length > 0 ? (
        <ExpenseFilters expenses={expenses} shown={shown.length} filter={filter} onChange={setFilter} members={membersById} myMemberId={me?.id} />
      ) : null}
      {expenses.length === 0 ? (
        <Empty title="No expenses yet">
          <T muted style={{ textAlign: 'center' }}>Add the first one, or invite people from the group settings.</T>
        </Empty>
      ) : (
        <View>
          {shown.map((e) => (
            <ExpenseRow
              key={e.id}
              expense={e}
              members={membersById}
              myMemberId={me?.id}
              onPress={() =>
                router.push(
                  e.kind === 'payment'
                    ? { pathname: '/group/[id]/settle', params: { id, expenseId: e.id } }
                    : { pathname: '/group/[id]/expense', params: { id, expenseId: e.id } },
                )
              }
            />
          ))}
        </View>
      )}

      <ExportCsvButton group={group} members={members} expenses={expenses} />
      <Button title="Group settings & invite" variant="secondary" onPress={() => router.push({ pathname: '/group/[id]/settings', params: { id } })} />
    </Screen>
  );
}
