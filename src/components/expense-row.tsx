import { View } from 'react-native';

import { ListRow, T } from '@/components/ui';
import { formatMoney } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import type { Expense, Member } from '@/lib/types';

/** One expense or payment with "you lent / you borrowed" from my point of view. */
export function ExpenseRow({
  expense,
  members,
  myMemberId,
  groupName,
  onPress,
}: {
  expense: Expense;
  members: Map<string, Member>;
  myMemberId?: string;
  groupName?: string;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const name = (id: string) => (id === myMemberId ? 'You' : members.get(id)?.display_name ?? 'Someone');
  const payers = expense.expense_shares.filter((s) => s.paid > 0);
  const mine = expense.expense_shares.find((s) => s.member_id === myMemberId);
  const net = mine ? mine.paid - mine.owed : 0;

  let subtitle: string;
  if (expense.kind === 'payment') {
    const receiver = expense.expense_shares.find((s) => s.owed > 0);
    subtitle = `${name(payers[0]?.member_id ?? '')} paid ${name(receiver?.member_id ?? '')}`;
  } else {
    const who = payers.length === 1 ? name(payers[0].member_id) : `${payers.length} people`;
    subtitle = `${who} paid ${formatMoney(expense.amount, expense.currency)}`;
  }
  subtitle = [expense.spent_on, groupName, expense.kind === 'expense' ? expense.category : null, subtitle]
    .filter(Boolean)
    .join(' · ');
  if (expense.recurring_id) subtitle = `↻ repeats · ${subtitle}`;

  return (
    <ListRow
      title={expense.kind === 'payment' ? `💸 ${expense.description}` : expense.description}
      subtitle={subtitle}
      onPress={onPress}
      right={
        <View style={{ alignItems: 'flex-end' }}>
          {expense.kind === 'payment' ? (
            <T variant="small" muted>{formatMoney(expense.amount, expense.currency)}</T>
          ) : net === 0 ? (
            <T variant="small" muted>{mine ? 'no balance' : 'not involved'}</T>
          ) : (
            <>
              <T variant="small" muted>{net > 0 ? 'you lent' : 'you borrowed'}</T>
              <T variant="small" color={net > 0 ? theme.positive : theme.negative} style={{ fontWeight: '600' }}>
                {formatMoney(Math.abs(net), expense.currency)}
              </T>
            </>
          )}
        </View>
      }
    />
  );
}
