import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { ArchivedNotice } from '@/components/archive';
import { ExpenseRow } from '@/components/expense-row';
import { Button, Card, Empty, ErrorText, Loading, Screen, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useDeletedExpenses, useRestoreExpense } from '@/lib/queries';
import { useGroup } from '@/lib/use-group';

const deletedOn = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

/** A group's deleted expenses and payments, most recently deleted first, each with a "Restore" button. */
export default function RecentlyDeleted() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, error, group, membersById, me } = useGroup(id);
  const deleted = useDeletedExpenses(id);
  const restore = useRestoreExpense();

  if (loading || deleted.isPending) return <Loading />;
  if (!group) {
    return (
      <Screen>
        <ErrorText error={error ?? 'This group does not exist or you are no longer a member.'} />
      </Screen>
    );
  }
  const items = deleted.data ?? [];

  return (
    <Screen refreshing={deleted.isRefetching} onRefresh={() => void deleted.refetch()}>
      <ArchivedNotice group={group} />
      <T muted>Restoring an expense or payment puts it back in the group and in everyone&apos;s balances.</T>
      <ErrorText error={deleted.error} />
      {restore.isSuccess ? <T variant="small" muted>Restored. It is back in the group.</T> : null}
      {items.length === 0 && !deleted.error ? (
        <Empty title="Nothing deleted">
          <T muted style={{ textAlign: 'center' }}>Expenses and payments deleted from this group show up here.</T>
        </Empty>
      ) : (
        items.map((e) => {
          // The last Restore tapped; its error (e.g. someone in it left the group) shows under it.
          const tapped = restore.variables?.p_expense_id === e.id;
          return (
            <Card key={e.id}>
              <ExpenseRow expense={e} members={membersById} myMemberId={me?.id} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                <T variant="small" muted style={{ flex: 1 }}>Deleted {deletedOn(e.deleted_at)}</T>
                <Button
                  title="Restore"
                  variant="secondary"
                  disabled={!!group.archived_at}
                  loading={tapped && restore.isPending}
                  onPress={() => restore.mutate({ p_expense_id: e.id })}
                />
              </View>
              {tapped ? <ErrorText error={restore.error} /> : null}
            </Card>
          );
        })
      )}
    </Screen>
  );
}
