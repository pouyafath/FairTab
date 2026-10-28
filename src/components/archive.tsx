import { Alert, Platform } from 'react-native';

import { Button, Card, ErrorText, T } from '@/components/ui';
import { useArchiveGroup, useUnarchiveGroup } from '@/lib/queries';
import type { Group } from '@/lib/types';

/** Shown at the top of an archived group's screens, with a button to make it editable again. */
export function ArchivedNotice({ group }: { group: Group }) {
  const unarchive = useUnarchiveGroup();
  if (!group.archived_at) return null;
  return (
    <Card>
      <T variant="heading">This group is archived, so it is read-only.</T>
      <T muted>Nobody can add or change expenses, payments or people until someone unarchives it.</T>
      <Button
        title="Unarchive"
        variant="secondary"
        loading={unarchive.isPending}
        onPress={() => unarchive.mutate({ p_group_id: group.id })}
      />
      <ErrorText error={unarchive.error} />
    </Card>
  );
}

/** "Archive group" / "Unarchive group" in the group settings. Any member can do either. */
export function ArchiveGroupButton({ group }: { group: Group }) {
  const archive = useArchiveGroup();
  const unarchive = useUnarchiveGroup();

  function onArchive() {
    const title = 'Archive this group?';
    const message = 'It becomes read-only for everyone and moves to the bottom of the groups list. You can unarchive it any time.';
    const doArchive = () => archive.mutate({ p_group_id: group.id });
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) doArchive();
    } else {
      Alert.alert(title, message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Archive', onPress: doArchive },
      ]);
    }
  }

  return (
    <>
      {group.archived_at ? (
        <Button
          title="Unarchive group"
          variant="secondary"
          loading={unarchive.isPending}
          onPress={() => unarchive.mutate({ p_group_id: group.id })}
        />
      ) : (
        <Button title="Archive group" variant="secondary" loading={archive.isPending} onPress={onArchive} />
      )}
      <ErrorText error={archive.error ?? unarchive.error} />
    </>
  );
}
