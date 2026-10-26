import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { SignInForm } from '@/components/sign-in-form';
import { Button, Card, ErrorText, Loading, Screen, T } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useJoinGroup } from '@/lib/queries';
import { supabase } from '@/lib/supabase';

interface Preview {
  group_id: string;
  group_name: string;
  member_count: number;
  already_member: boolean;
  guests: { id: string; display_name: string }[];
}

export default function Join() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { session } = useAuth();

  if (!session) {
    return (
      <Screen>
        <T variant="heading">Sign in to join the group</T>
        <Card>
          <SignInForm />
        </Card>
      </Screen>
    );
  }
  return <JoinPreview code={code} />;
}

function JoinPreview({ code }: { code: string }) {
  const join = useJoinGroup();
  const preview = useQuery({
    queryKey: ['invite', code],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('preview_invite', { p_code: code });
      if (error) throw error;
      return ((data as Preview[]) ?? [])[0] ?? null;
    },
  });

  const alreadyMember = preview.data?.already_member;
  const groupId = preview.data?.group_id;
  useEffect(() => {
    if (alreadyMember && groupId) router.replace({ pathname: '/group/[id]', params: { id: groupId } });
  }, [alreadyMember, groupId]);

  if (preview.isPending) return <Loading />;
  if (!preview.data) {
    return (
      <Screen>
        <ErrorText error={preview.error ?? 'This invite link is not valid anymore. Ask for a new one.'} />
      </Screen>
    );
  }

  const p = preview.data;
  const doJoin = (claim: string | null) =>
    join.mutate(
      { p_code: code, p_claim_member_id: claim },
      { onSuccess: (id) => router.replace({ pathname: '/group/[id]', params: { id } }) },
    );

  return (
    <Screen>
      <T variant="title">{p.group_name}</T>
      <T muted>{p.member_count} people are in this group.</T>
      {p.guests.length > 0 ? (
        <Card>
          <T variant="heading">Are you one of these people?</T>
          <T muted>Pick your name to take over expenses that were already added for you.</T>
          {p.guests.map((g) => (
            <Button key={g.id} title={`I am ${g.display_name}`} variant="secondary" onPress={() => doJoin(g.id)} disabled={join.isPending} />
          ))}
        </Card>
      ) : null}
      <ErrorText error={join.error} />
      <Button title={p.guests.length ? "I'm not on the list, join as new" : 'Join group'} onPress={() => doJoin(null)} loading={join.isPending} />
    </Screen>
  );
}
