import { useState } from 'react';
import { View } from 'react-native';

import { Button, ErrorText, Field, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

/** Invite-only mode (signup_allowlist) and disabled sign-ups surface as generic errors; explain them. */
function friendlyAuthError(error: { message: string }) {
  if (/database error saving new user|signups not allowed|invite-only/i.test(error.message)) {
    return new Error('This FairTab is invite-only. Ask the owner to add your email address.');
  }
  return error;
}

/** Passwordless sign-in: we email a one-time code. New users are created automatically. */
export function SignInForm() {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function sendCode() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, data: name.trim() ? { display_name: name.trim() } : undefined },
    });
    setBusy(false);
    if (error) setError(friendlyAuthError(error));
    else setStep('code');
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setError(error);
  }

  if (step === 'code') {
    return (
      <View style={{ gap: Spacing.three }}>
        <T>We sent a code to {email.trim()}. Enter it below (check your spam folder too).</T>
        <Field
          label="Code"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={10}
          autoFocus
        />
        <ErrorText error={error} />
        <Button title="Sign in" onPress={verify} loading={busy} disabled={code.trim().length < 6} />
        <Button title="Use a different email" variant="secondary" onPress={() => setStep('email')} />
      </View>
    );
  }

  return (
    <View style={{ gap: Spacing.three }}>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        placeholder="you@example.com"
      />
      <Field label="Your name (for new accounts)" value={name} onChangeText={setName} placeholder="Optional" />
      <ErrorText error={error} />
      <Button title="Email me a code" onPress={sendCode} loading={busy} disabled={!/^\S+@\S+\.\S+$/.test(email.trim())} />
    </View>
  );
}
