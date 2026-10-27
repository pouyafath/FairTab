import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { CurrencyPicker } from '@/components/currency-picker';
import { Button, Card, Chip, ChipRow, ErrorText, Field, Loading, Screen, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { parseAmount, toInputString } from '@/domain';
import { todayLocal } from '@/lib/dates';
import { shareOrCopy } from '@/lib/invite';
import { paymentRequestMessage } from '@/lib/messages';
import { useDeleteExpense, useSaveExpense } from '@/lib/queries';
import type { Expense, Group, Member } from '@/lib/types';
import { useGroup } from '@/lib/use-group';

type Params = { id: string; expenseId?: string; from?: string; to?: string; amount?: string; currency?: string };

export default function SettleScreen() {
  const params = useLocalSearchParams<Params>();
  const { loading, error, group, members, me, expenses } = useGroup(params.id);

  if (loading) return <Loading />;
  const payment = params.expenseId ? expenses.find((e) => e.id === params.expenseId) : undefined;
  if (!group || !me || (params.expenseId && !payment)) {
    return (
      <Screen>
        <ErrorText error={error ?? 'Payment not found.'} />
      </Screen>
    );
  }
  // Former members can still be paid back (or pay back) what was owed when they left.
  const involved = new Set([params.from, params.to, ...(payment?.expense_shares.map((s) => s.member_id) ?? [])]);
  const formMembers = members.filter((m) => !m.left_at || involved.has(m.id));
  return <SettleForm group={group} members={formMembers} meId={me.id} payment={payment} params={params} />;
}

function SettleForm({
  group, members, meId, payment, params,
}: { group: Group; members: Member[]; meId: string; payment?: Expense; params: Params }) {
  const currency0 = payment?.currency ?? params.currency ?? group.default_currency;
  const amount0 = payment?.amount ?? (params.amount ? Number(params.amount) : null);
  const [from, setFrom] = useState(payment?.expense_shares.find((s) => s.paid > 0)?.member_id ?? params.from ?? meId);
  const [to, setTo] = useState(
    payment?.expense_shares.find((s) => s.owed > 0)?.member_id ?? params.to ?? members.find((m) => m.id !== meId)?.id ?? '',
  );
  const [currency, setCurrency] = useState(currency0);
  const [amountText, setAmountText] = useState(amount0 ? toInputString(amount0, currency0) : '');
  const [copied, setCopied] = useState(false);
  const save = useSaveExpense();
  const remove = useDeleteExpense();

  const validCurrency = /^[A-Z]{3}$/.test(currency);
  const amount = validCurrency ? parseAmount(amountText, currency) : null;
  const canSave = amount !== null && amount > 0 && !!from && !!to && from !== to;
  const name = (m: Member) => (m.id === meId ? 'You' : m.display_name);
  const toMember = members.find((m) => m.id === to);

  function onSave() {
    if (!canSave || amount === null) return;
    save.mutate(
      {
        p_group_id: group.id,
        p_kind: 'payment',
        p_description: 'Payment',
        p_amount: amount,
        p_currency: currency,
        p_shares: [
          { member_id: from, paid: amount, owed: 0 },
          { member_id: to, paid: 0, owed: amount },
        ],
        p_spent_on: payment?.spent_on ?? todayLocal(),
        p_expense_id: payment?.id ?? null,
      },
      { onSuccess: () => router.back() },
    );
  }

  function onDelete() {
    if (!payment) return;
    const doDelete = () => remove.mutate({ p_expense_id: payment.id }, { onSuccess: () => router.back() });
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this payment?')) doDelete();
    } else {
      Alert.alert('Delete this payment?', undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  }

  async function onCopyMessage() {
    if (!canSave || amount === null || !toMember) return;
    const result = await shareOrCopy(paymentRequestMessage(amount, currency, toMember.display_name, group.name));
    setCopied(result === 'copied');
  }

  return (
    <Screen>
      <Card>
        <T variant="label" muted>Who paid</T>
        <ChipRow>
          {members.map((m) => <Chip key={m.id} label={name(m)} selected={from === m.id} onPress={() => setFrom(m.id)} />)}
        </ChipRow>
        <T variant="label" muted>Who received</T>
        <ChipRow>
          {members.map((m) => <Chip key={m.id} label={name(m)} selected={to === m.id} onPress={() => setTo(m.id)} />)}
        </ChipRow>
      </Card>
      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
        <View style={{ flex: 2 }}>
          <Field label="Amount" value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <CurrencyPicker label="Currency" value={currency} onChange={setCurrency} pinned={[group.default_currency]} />
        </View>
      </View>
      <T variant="small" muted>
        This only records the payment. Send the money however you like ({currency === 'CAD' ? 'Interac e-Transfer, ' : ''}cash, bank…).
      </T>
      <Button
        title={copied ? 'Message copied' : currency === 'CAD' ? 'Copy Interac e-Transfer message' : 'Copy payment message'}
        variant="secondary"
        disabled={!canSave}
        onPress={onCopyMessage}
      />
      <ErrorText error={save.error ?? remove.error} />
      <Button title={payment ? 'Save payment' : 'Record payment'} onPress={onSave} disabled={!canSave} loading={save.isPending} />
      {payment ? <Button title="Delete payment" variant="danger" onPress={onDelete} loading={remove.isPending} /> : null}
    </Screen>
  );
}
