import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import { CurrencyPicker } from '@/components/currency-picker';
import { Button, Card, ErrorText, Field, Loading, Screen, T } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { useProfile, useUpdate } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

export default function Account() {
  const userId = useUserId();
  const profile = useProfile(userId);
  const client = useQueryClient();

  async function signOut() {
    await supabase.auth.signOut();
    client.clear();
  }

  return (
    <Screen>
      {profile.isPending ? <Loading /> : profile.data ? <ProfileForm key={profile.data.id} profile={profile.data} /> : null}
      <ErrorText error={profile.error} />
      <Card>
        <T variant="heading">Moving from Splitwise?</T>
        <T muted>Export each group from Splitwise as a spreadsheet (CSV) and import it here, history and balances included.</T>
        <Button title="Import from Splitwise" variant="secondary" onPress={() => router.push('/import')} />
      </Card>
      <Card>
        <T variant="heading">Free forever</T>
        <T muted>
          Unlimited expenses, groups and friends, with no ads. Optional extras may come later, but the core app stays free.
        </T>
      </Card>
      <Button title="Sign out" variant="danger" onPress={signOut} />
    </Screen>
  );
}

function ProfileForm({ profile }: { profile: Profile }) {
  const [name, setName] = useState(profile.display_name);
  const [currency, setCurrency] = useState(profile.default_currency);
  const update = useUpdate<Pick<Profile, 'display_name' | 'default_currency'>>('profiles');
  const validCurrency = /^[A-Z]{3}$/.test(currency);
  const changed = name.trim() !== profile.display_name || currency !== profile.default_currency;

  return (
    <Card>
      <T variant="heading">Your profile</T>
      <Field label="Name" value={name} onChangeText={setName} maxLength={80} />
      <CurrencyPicker
        label="Default currency"
        value={currency}
        onChange={setCurrency}
        error={validCurrency ? undefined : 'Use a 3-letter code like USD, EUR or IRR'}
      />
      <ErrorText error={update.error} />
      <Button
        title={update.isSuccess && !changed ? 'Saved' : 'Save'}
        disabled={!changed || !validCurrency || !name.trim()}
        loading={update.isPending}
        onPress={() =>
          update.mutate({ id: profile.id, values: { display_name: name.trim(), default_currency: currency } })
        }
      />
    </Card>
  );
}
