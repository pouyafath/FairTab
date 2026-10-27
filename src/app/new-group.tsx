import { router } from 'expo-router';
import { useState } from 'react';

import { CurrencyPicker } from '@/components/currency-picker';
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
      <CurrencyPicker
        label="Currency"
        value={effectiveCurrency}
        onChange={setCurrency}
        pinned={[profile.data?.default_currency]}
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
