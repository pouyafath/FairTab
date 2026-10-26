import { router } from 'expo-router';
import { useState } from 'react';

import { Button, ErrorText, Field, Screen } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { useCreateGroup, useProfile } from '@/lib/queries';

export default function NewGroup() {
  const profile = useProfile(useUserId());
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<string | null>(null);
  const create = useCreateGroup();
  const effectiveCurrency = currency ?? profile.data?.default_currency ?? 'USD';
  const validCurrency = /^[A-Z]{3}$/.test(effectiveCurrency);

  return (
    <Screen>
      <Field label="Group name" value={name} onChangeText={setName} placeholder="Flat, Trip to Rome…" maxLength={100} autoFocus />
      <Field
        label="Currency"
        value={effectiveCurrency}
        onChangeText={(v) => setCurrency(v.toUpperCase())}
        autoCapitalize="characters"
        maxLength={3}
        error={validCurrency ? undefined : 'Use a 3-letter code'}
      />
      <ErrorText error={create.error} />
      <Button
        title="Create group"
        disabled={!name.trim() || !validCurrency}
        loading={create.isPending}
        onPress={() =>
          create.mutate(
            { p_name: name.trim(), p_currency: effectiveCurrency },
            { onSuccess: (id) => router.replace({ pathname: '/group/[id]/settings', params: { id } }) },
          )
        }
      />
    </Screen>
  );
}
