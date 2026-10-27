import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Switch, View } from 'react-native';

import { ArchivedNotice, ArchiveGroupButton } from '@/components/archive';
import { Button, Card, ErrorText, Field, ListRow, Loading, Screen, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useUserId } from '@/lib/auth';
import { inviteUrl, shareInvite } from '@/lib/invite';
import {
  useAddGuest,
  useDeleteGroup,
  useLeaveGroup,
  useRegenerateInvite,
  useRemoveMember,
  useUpdate,
} from '@/lib/queries';
import type { Group, Member } from '@/lib/types';
import { useGroup } from '@/lib/use-group';

export default function GroupSettings() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { loading, error, group, activeMembers, me } = useGroup(id);
  if (loading) return <Loading />;
  if (!group) {
    return (
      <Screen>
        <ErrorText error={error ?? 'Group not found.'} />
      </Screen>
    );
  }
  return <SettingsForm key={group.id} group={group} members={activeMembers} meId={me?.id} />;
}

function confirm(title: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(title)) onYes();
  } else {
    Alert.alert(title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: onYes },
    ]);
  }
}

function SettingsForm({ group, members, meId }: { group: Group; members: Member[]; meId?: string }) {
  const userId = useUserId();
  const [name, setName] = useState(group.name);
  const [currency, setCurrency] = useState(group.default_currency);
  const [guestName, setGuestName] = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const update = useUpdate<Partial<Pick<Group, 'name' | 'default_currency' | 'simplify_debts'>>>('groups');
  const addGuest = useAddGuest();
  const removeMember = useRemoveMember();
  const regenerate = useRegenerateInvite();
  const leave = useLeaveGroup();
  const deleteGroup = useDeleteGroup();
  // Archived groups are read-only (the database refuses changes too).
  const archived = !!group.archived_at;

  const changed = name.trim() !== group.name || currency !== group.default_currency;
  const validCurrency = /^[A-Z]{3}$/.test(currency);

  return (
    <Screen>
      <ArchivedNotice group={group} />
      <Card>
        <T variant="heading">Invite people</T>
        <T muted>Anyone with this link can join the group. They can also take over a person you already added.</T>
        <T variant="small" selectable>{inviteUrl(group.invite_code)}</T>
        <Button
          title="Share invite link"
          onPress={() => shareInvite(group.name, group.invite_code).then((s) => setShareStatus(s === 'copied' ? 'Link copied' : ''))}
        />
        {shareStatus ? <T variant="small" muted>{shareStatus}</T> : null}
        <Button
          title="Make a new link (old one stops working)"
          variant="secondary"
          disabled={archived}
          loading={regenerate.isPending}
          onPress={() => confirm('Make a new invite link?', () => regenerate.mutate({ p_group_id: group.id }))}
        />
      </Card>

      <Card>
        <T variant="heading">People</T>
        {members.map((m) => (
          <ListRow
            key={m.id}
            title={m.id === meId ? `${m.display_name} (you)` : m.display_name}
            subtitle={m.user_id ? 'joined' : 'not joined yet'}
            right={m.id === meId ? undefined : <T variant="small" muted>remove</T>}
            onPress={
              m.id === meId
                ? undefined
                : () => confirm(`Remove ${m.display_name} from the group?`, () => removeMember.mutate({ p_member_id: m.id }))
            }
          />
        ))}
        <T variant="small" muted>People can be removed once they are settled up.</T>
        <ErrorText error={removeMember.error} />
        <View style={{ flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Field label="Add a person by name" value={guestName} onChangeText={setGuestName} placeholder="e.g. Sara" maxLength={80} />
          </View>
          <Button
            title="Add"
            disabled={archived || !guestName.trim()}
            loading={addGuest.isPending}
            onPress={() =>
              addGuest.mutate({ group_id: group.id, display_name: guestName.trim() }, { onSuccess: () => setGuestName('') })
            }
          />
        </View>
        <ErrorText error={addGuest.error} />
      </Card>

      <Card>
        <T variant="heading">Settings</T>
        <Field label="Group name" value={name} onChangeText={setName} maxLength={100} />
        <Field
          label="Default currency"
          value={currency}
          onChangeText={(v) => setCurrency(v.toUpperCase())}
          autoCapitalize="characters"
          maxLength={3}
          error={validCurrency ? undefined : 'Use a 3-letter code'}
        />
        <Button
          title="Save"
          disabled={archived || !changed || !validCurrency || !name.trim()}
          loading={update.isPending}
          onPress={() => update.mutate({ id: group.id, values: { name: name.trim(), default_currency: currency } })}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
          <View style={{ flex: 1 }}>
            <T>Simplify debts</T>
            <T variant="small" muted>Combine debts so the group needs fewer payments to settle up.</T>
          </View>
          <Switch
            value={group.simplify_debts}
            disabled={archived}
            onValueChange={(v) => update.mutate({ id: group.id, values: { simplify_debts: v } })}
          />
        </View>
        <ErrorText error={update.error} />
      </Card>

      <ArchiveGroupButton group={group} />
      <ErrorText error={leave.error ?? regenerate.error ?? deleteGroup.error} />
      <Button
        title="Leave group"
        variant="danger"
        onPress={() =>
          confirm('Leave this group? You need to be settled up first.', () =>
            leave.mutate({ p_group_id: group.id }, { onSuccess: () => router.replace('/') }),
          )
        }
      />
      {group.created_by === userId ? (
        <Button
          title="Delete group for everyone"
          variant="danger"
          loading={deleteGroup.isPending}
          onPress={() =>
            confirm(`Delete "${group.name}" and all its expenses for everyone?`, () =>
              deleteGroup.mutate({ p_group_id: group.id }, { onSuccess: () => router.replace('/') }),
            )
          }
        />
      ) : null}
    </Screen>
  );
}
