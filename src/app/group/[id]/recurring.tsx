import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Platform, View } from 'react-native';

import { ArchivedNotice } from '@/components/archive';
import { Button, Card, Empty, ErrorText, Loading, Screen, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { formatMoney } from '@/domain';
import { repeatEnded, repeatSummary } from '@/domain/recurring';
import { useDeleteRecurring, useInvalidateAll, useRecurringExpenses, useSetRecurringPaused } from '@/lib/queries';
import { useGroup } from '@/lib/use-group';

function confirm(title: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(title)) onYes();
  } else {
    Alert.alert(title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onYes },
    ]);
  }
}

export default function RecurringScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, error, group, membersById, me } = useGroup(id);
  const rules = useRecurringExpenses();
  const pause = useSetRecurringPaused();
  const remove = useDeleteRecurring();
  const refresh = useInvalidateAll();

  if (loading || rules.isPending) return <Loading />;
  if (!group) {
    return (
      <Screen>
        <ErrorText error={error ?? 'This group does not exist or you are no longer a member.'} />
      </Screen>
    );
  }

  const list = (rules.data ?? []).filter((r) => r.group_id === id);
  const archived = !!group.archived_at;
  const name = (memberId: string) => (memberId === me?.id ? 'You' : membersById.get(memberId)?.display_name ?? 'Someone');

  return (
    <Screen refreshing={rules.isRefetching} onRefresh={refresh}>
      <ArchivedNotice group={group} />
      <T muted>Expenses that are added again by themselves, like rent or subscriptions.</T>
      <ErrorText error={rules.error ?? pause.error ?? remove.error} />
      {list.length === 0 ? (
        <Empty title="No recurring expenses yet">
          <T muted style={{ textAlign: 'center' }}>Add an expense and choose how often it repeats.</T>
          {archived ? null : (
            <Button title="Add expense" onPress={() => router.push({ pathname: '/group/[id]/expense', params: { id } })} />
          )}
        </Empty>
      ) : (
        list.map((rule) => {
          const payers = rule.shares.filter((s) => s.paid > 0);
          const people = rule.shares.filter((s) => s.owed > 0).length;
          const who = payers.length === 1 ? name(payers[0].member_id) : `${payers.length} people`;
          const busy = (m: { variables?: { p_recurring_id: string } }) => m.variables?.p_recurring_id === rule.id;
          return (
            <Card key={rule.id}>
              <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                <T variant="heading" numberOfLines={1} style={{ flex: 1 }}>{rule.description}</T>
                <T variant="heading">{formatMoney(rule.amount, rule.currency)}</T>
              </View>
              <T variant="small" muted>{repeatSummary(rule)}</T>
              <T variant="small" muted>
                {who} paid · split between {people} {people === 1 ? 'person' : 'people'}
              </T>
              {rule.paused && !repeatEnded(rule) ? (
                <T variant="small" muted>
                  Paused: nothing new is added. It also pauses by itself if someone in it leaves the group. When you
                  resume, the dates you missed are skipped.
                </T>
              ) : null}
              {archived ? null : (
                <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                  {repeatEnded(rule) ? null : (
                    <View style={{ flex: 1 }}>
                      <Button
                        title={rule.paused ? 'Resume' : 'Pause'}
                        variant="secondary"
                        loading={pause.isPending && busy(pause)}
                        onPress={() => pause.mutate({ p_recurring_id: rule.id, p_paused: !rule.paused })}
                      />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Delete"
                      variant="danger"
                      loading={remove.isPending && busy(remove)}
                      onPress={() =>
                        confirm(`Delete "${rule.description}"? Expenses it already added stay.`, () =>
                          remove.mutate({ p_recurring_id: rule.id }),
                        )
                      }
                    />
                  </View>
                </View>
              )}
            </Card>
          );
        })
      )}
    </Screen>
  );
}
