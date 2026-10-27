import { ArchivedNotice } from '@/components/archive';
import { Card, ListRow, Screen, T } from '@/components/ui';
import { formatMoney } from '@/domain';
import type { Expense, Group, Member } from '@/lib/types';

/** Replaces the expense or payment form while the group is archived: the details, nothing to edit. */
export function ReadOnlyExpense({
  group,
  expense,
  members,
  meId,
}: {
  group: Group;
  expense?: Expense;
  members: Member[];
  meId: string;
}) {
  const byId = new Map(members.map((m) => [m.id, m]));
  const name = (id: string) => (id === meId ? 'You' : byId.get(id)?.display_name ?? 'Someone');

  return (
    <Screen>
      <ArchivedNotice group={group} />
      {expense ? (
        <Card>
          <T variant="heading">{expense.description}</T>
          <T variant="title">{formatMoney(expense.amount, expense.currency)}</T>
          <T muted>{[expense.spent_on, expense.kind === 'expense' ? expense.category : null].filter(Boolean).join(' · ')}</T>
          {expense.kind === 'payment' ? (
            <T>
              {name(expense.expense_shares.find((s) => s.paid > 0)?.member_id ?? '')} paid{' '}
              {name(expense.expense_shares.find((s) => s.owed > 0)?.member_id ?? '')}
            </T>
          ) : (
            <>
              <T variant="label" muted>Paid by</T>
              {expense.expense_shares
                .filter((s) => s.paid > 0)
                .map((s) => (
                  <ListRow key={s.member_id} title={name(s.member_id)} right={<T>{formatMoney(s.paid, expense.currency)}</T>} />
                ))}
              <T variant="label" muted>Split</T>
              {expense.expense_shares
                .filter((s) => s.owed > 0)
                .map((s) => (
                  <ListRow key={s.member_id} title={name(s.member_id)} right={<T>{formatMoney(s.owed, expense.currency)}</T>} />
                ))}
            </>
          )}
          {expense.notes ? (
            <>
              <T variant="label" muted>Notes</T>
              <T>{expense.notes}</T>
            </>
          ) : null}
        </Card>
      ) : null}
    </Screen>
  );
}
