import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { RepeatCard } from '@/components/repeat-card';
import { Button, Card, Chip, ChipRow, ErrorText, Field, ListRow, Loading, Screen, T } from '@/components/ui';
import { CATEGORIES } from '@/constants/categories';
import { Spacing } from '@/constants/theme';
import {
  computeOwed,
  formatMoney,
  parseAmount,
  SplitError,
  toInputString,
  type SplitEntry,
  type SplitMethod,
} from '@/domain';
import type { RepeatFrequency } from '@/domain/recurring';
import { isValidDate, todayLocal } from '@/lib/dates';
import { useCreateRecurring, useDeleteExpense, useSaveExpense } from '@/lib/queries';
import type { Expense, Group, Member } from '@/lib/types';
import { useGroup } from '@/lib/use-group';

const METHODS: { key: SplitMethod; label: string }[] = [
  { key: 'equal', label: 'Equally' },
  { key: 'exact', label: 'Exact amounts' },
  { key: 'percent', label: 'Percent' },
  { key: 'shares', label: 'Shares' },
];

export default function ExpenseScreen() {
  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId?: string }>();
  const { loading, error, group, members, activeMembers, me, expenses } = useGroup(id);

  if (loading) return <Loading />;
  const expense = expenseId ? expenses.find((e) => e.id === expenseId) : undefined;
  if (!group || !me || (expenseId && !expense)) {
    return (
      <Screen>
        <ErrorText error={error ?? 'Expense not found.'} />
      </Screen>
    );
  }
  // New expenses can only include current members; an old expense also keeps the people in it.
  const inExpense = new Set(expense?.expense_shares.map((s) => s.member_id) ?? []);
  const formMembers = members.filter((m) => !m.left_at || inExpense.has(m.id));
  return (
    <ExpenseForm
      key={expense?.id ?? 'new'}
      group={group}
      members={expense ? formMembers : activeMembers}
      meId={me.id}
      expense={expense}
    />
  );
}

interface SplitState {
  method: SplitMethod;
  included: string[];
  values: Record<string, string>;
}

function initialSplit(members: Member[], expense?: Expense): SplitState {
  if (!expense) return { method: 'equal', included: members.map((m) => m.id), values: {} };
  const owing = expense.expense_shares.filter((s) => s.owed > 0);
  const ids = owing.map((s) => s.member_id);
  try {
    const equal = computeOwed(expense.amount, 'equal', ids.map((memberId) => ({ memberId })));
    if (owing.every((s) => equal[s.member_id] === s.owed)) return { method: 'equal', included: ids, values: {} };
  } catch {
    // Fall through to exact amounts.
  }
  return {
    method: 'exact',
    included: ids,
    values: Object.fromEntries(owing.map((s) => [s.member_id, toInputString(s.owed, expense.currency)])),
  };
}

function ExpenseForm({ group, members, meId, expense }: { group: Group; members: Member[]; meId: string; expense?: Expense }) {
  const payers = expense?.expense_shares.filter((s) => s.paid > 0).sort((a, b) => b.paid - a.paid) ?? [];
  const [description, setDescription] = useState(expense?.description ?? '');
  const [amountText, setAmountText] = useState(expense ? toInputString(expense.amount, expense.currency) : '');
  const [currency, setCurrency] = useState(expense?.currency ?? group.default_currency);
  const [date, setDate] = useState(expense?.spent_on ?? todayLocal());
  const [category, setCategory] = useState<string | null>(expense?.category ?? null);
  const [notes, setNotes] = useState(expense?.notes ?? '');
  const [severalPayers, setSeveralPayers] = useState(payers.length > 1);
  const [paidBy, setPaidBy] = useState(payers[0]?.member_id ?? meId);
  const [paidValues, setPaidValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(payers.map((s) => [s.member_id, toInputString(s.paid, expense!.currency)])),
  );
  const [split, setSplit] = useState<SplitState>(() => initialSplit(members, expense));
  const [repeat, setRepeat] = useState<RepeatFrequency | null>(null);
  const save = useSaveExpense();
  const remove = useDeleteExpense();
  const createRecurring = useCreateRecurring();

  const validCurrency = /^[A-Z]{3}$/.test(currency);
  const amount = validCurrency ? parseAmount(amountText, currency) : null;
  const validDate = isValidDate(date);

  // Who paid how much.
  let paid: Record<string, number> | null = null;
  let paidError: string | null = null;
  if (amount !== null && amount > 0) {
    if (!severalPayers) {
      paid = { [paidBy]: amount };
    } else {
      const entries = members.map((m) => [m.id, parseAmount(paidValues[m.id] ?? '', currency) ?? 0] as const);
      const sum = entries.reduce((a, [, v]) => a + v, 0);
      if (sum !== amount) {
        paidError = `Paid amounts add up to ${formatMoney(sum, currency)}, not ${formatMoney(amount, currency)}`;
      } else {
        paid = Object.fromEntries(entries.filter(([, v]) => v > 0));
      }
    }
  }

  // Who owes how much.
  const entries: SplitEntry[] = split.included.map((memberId) => {
    const raw = split.values[memberId] ?? '';
    if (split.method === 'exact') return { memberId, value: parseAmount(raw, currency) ?? 0 };
    if (split.method === 'equal') return { memberId };
    const n = Number(raw.replace(',', '.'));
    return { memberId, value: Number.isFinite(n) ? n : 0 };
  });
  let owed: Record<string, number> | null = null;
  let splitError: string | null = null;
  if (amount !== null && amount > 0) {
    try {
      owed = computeOwed(amount, split.method, entries, currency);
    } catch (e) {
      splitError = e instanceof SplitError ? e.message : String(e);
    }
  }

  const canSave = !!description.trim() && amount !== null && amount > 0 && !!paid && !!owed && validDate;

  function toggle(memberId: string) {
    setSplit((s) => ({
      ...s,
      included: s.included.includes(memberId) ? s.included.filter((m) => m !== memberId) : [...s.included, memberId],
    }));
  }

  function onSave() {
    if (!owed || !paid || amount === null) return;
    const shares = new Map<string, { member_id: string; paid: number; owed: number }>();
    const share = (memberId: string) => {
      let s = shares.get(memberId);
      if (!s) shares.set(memberId, (s = { member_id: memberId, paid: 0, owed: 0 }));
      return s;
    };
    for (const [memberId, value] of Object.entries(paid)) share(memberId).paid = value;
    for (const [memberId, value] of Object.entries(owed)) share(memberId).owed = value;
    if (repeat && !expense) {
      // The recurring expense adds this first one itself (now, or on the date if it is in the future).
      createRecurring.mutate(
        {
          p_group_id: group.id,
          p_description: description.trim(),
          p_amount: amount,
          p_currency: currency,
          p_shares: [...shares.values()],
          p_category: category,
          p_notes: notes.trim() || null,
          p_frequency: repeat,
          p_start_on: date,
        },
        { onSuccess: () => router.back() },
      );
      return;
    }
    save.mutate(
      {
        p_group_id: group.id,
        p_description: description.trim(),
        p_amount: amount,
        p_currency: currency,
        p_shares: [...shares.values()],
        p_category: category,
        p_notes: notes.trim() || null,
        p_spent_on: date,
        p_expense_id: expense?.id ?? null,
      },
      { onSuccess: () => router.back() },
    );
  }

  function onDelete() {
    if (!expense) return;
    const doDelete = () => remove.mutate({ p_expense_id: expense.id }, { onSuccess: () => router.back() });
    if (Platform.OS === 'web') {
      if (window.confirm('Delete this expense?')) doDelete();
    } else {
      Alert.alert('Delete this expense?', undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  }

  const name = (m: Member) => (m.id === meId ? 'You' : m.display_name);
  const categories: string[] = category && !(CATEGORIES as readonly string[]).includes(category) ? [...CATEGORIES, category] : [...CATEGORIES];

  return (
    <Screen>
      <Field label="Description" value={description} onChangeText={setDescription} placeholder="Dinner, rent, taxi…" maxLength={200} autoFocus={!expense} />
      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
        <View style={{ flex: 2 }}>
          <Field label="Amount" value={amountText} onChangeText={setAmountText} keyboardType="decimal-pad" placeholder="0.00" />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Currency"
            value={currency}
            onChangeText={(v) => setCurrency(v.toUpperCase())}
            autoCapitalize="characters"
            maxLength={3}
            error={validCurrency ? undefined : 'e.g. EUR'}
          />
        </View>
      </View>
      <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} error={validDate ? undefined : 'Use a date like 2026-10-26'} />

      <Card>
        <T variant="label" muted>Paid by</T>
        <ChipRow>
          {members.map((m) => (
            <Chip
              key={m.id}
              label={name(m)}
              selected={!severalPayers && paidBy === m.id}
              onPress={() => {
                setSeveralPayers(false);
                setPaidBy(m.id);
              }}
            />
          ))}
          <Chip label="Several people" selected={severalPayers} onPress={() => setSeveralPayers(true)} />
        </ChipRow>
        {severalPayers
          ? members.map((m) => (
              <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                <T style={{ flex: 1 }}>{name(m)}</T>
                <View style={{ width: 130 }}>
                  <Field
                    label={`paid (${currency})`}
                    value={paidValues[m.id] ?? ''}
                    onChangeText={(v) => setPaidValues((p) => ({ ...p, [m.id]: v }))}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            ))
          : null}
        {paidError ? <ErrorText error={paidError} /> : null}
      </Card>

      <Card>
        <T variant="label" muted>Split</T>
        <ChipRow>
          {METHODS.map((m) => (
            <Chip key={m.key} label={m.label} selected={split.method === m.key} onPress={() => setSplit((s) => ({ ...s, method: m.key }))} />
          ))}
        </ChipRow>
        {members.map((m) => {
          const included = split.included.includes(m.id);
          return (
            <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
              <View style={{ flex: 1 }}>
                <ListRow
                  title={`${included ? '☑' : '☐'}  ${name(m)}`}
                  onPress={() => toggle(m.id)}
                  right={
                    included && owed ? <T variant="small" muted>{formatMoney(owed[m.id] ?? 0, currency)}</T> : undefined
                  }
                />
              </View>
              {included && split.method !== 'equal' ? (
                <View style={{ width: 110 }}>
                  <Field
                    label={split.method === 'exact' ? currency : split.method === 'percent' ? '%' : 'shares'}
                    value={split.values[m.id] ?? ''}
                    onChangeText={(v) => setSplit((s) => ({ ...s, values: { ...s.values, [m.id]: v } }))}
                    keyboardType="decimal-pad"
                  />
                </View>
              ) : null}
            </View>
          );
        })}
        {splitError ? <ErrorText error={splitError} /> : null}
      </Card>

      <Card>
        <T variant="label" muted>Category</T>
        <ChipRow>
          {categories.map((c) => (
            <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(category === c ? null : c)} />
          ))}
        </ChipRow>
      </Card>
      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} maxLength={1000} multiline style={{ minHeight: 72, textAlignVertical: 'top', paddingTop: 12 }} />
      {expense ? null : <RepeatCard value={repeat} onChange={setRepeat} startOn={date} />}

      <ErrorText error={save.error ?? remove.error ?? createRecurring.error} />
      <Button title={expense ? 'Save changes' : 'Add expense'} onPress={onSave} disabled={!canSave} loading={save.isPending || createRecurring.isPending} />
      {expense ? <Button title="Delete expense" variant="danger" onPress={onDelete} loading={remove.isPending} /> : null}
    </Screen>
  );
}
