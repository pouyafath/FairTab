import { useState } from 'react';
import { FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Button, Field, T } from '@/components/ui';
import { currencyLabel, findCurrency, searchCurrencies, type Currency } from '@/constants/currencies';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Looks like a Field, but opens a searchable list of currencies instead of asking for a 3-letter code.
 * The current choice and the `pinned` codes (e.g. the group's or your default currency) are listed first.
 */
export function CurrencyPicker({
  label,
  value,
  onChange,
  pinned = [],
  error,
}: {
  label: string;
  value: string;
  onChange: (code: string) => void;
  pinned?: (string | null | undefined)[];
  error?: string;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { name } = findCurrency(value);
  const results = open ? searchCurrencies(query, { pinned: [value, ...pinned] }) : [];

  function close() {
    setOpen(false);
    setQuery('');
  }

  function select(code: string) {
    onChange(code);
    close();
  }

  return (
    <View style={{ gap: Spacing.one }}>
      <T variant="label" muted>
        {label}
      </T>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${name ? `${name}, ${value}` : value || 'none'}`}
        accessibilityHint="Opens a list of currencies"
        onPress={() => {
          Keyboard.dismiss();
          setOpen(true);
        }}
        style={({ pressed }) => [
          styles.box,
          { borderColor: error ? theme.danger : theme.border, backgroundColor: theme.card },
          pressed && { opacity: 0.6 },
        ]}>
        <T numberOfLines={1} muted={!value} style={{ flex: 1 }}>
          {value ? currencyLabel(value) : 'Choose a currency'}
        </T>
        <T muted>▾</T>
      </Pressable>
      {error ? <T variant="small" color={theme.danger}>{error}</T> : null}

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close the currency list"
            onPress={close}
            style={[StyleSheet.absoluteFill, styles.dim]}
          />
          <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.header}>
              <T variant="heading" accessibilityRole="header" style={{ flex: 1 }}>
                {label}
              </T>
              <Button title="Close" variant="secondary" onPress={close} />
            </View>
            <Field
              label="Search"
              value={query}
              onChangeText={setQuery}
              placeholder="Code or name, e.g. EUR or euro"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={Platform.OS === 'web'}
              returnKeyType="done"
              onSubmitEditing={() => (results[0] ? select(results[0].code) : undefined)}
            />
            <FlatList
              data={results}
              keyExtractor={(c) => c.code}
              keyboardShouldPersistTaps="handled"
              style={{ flex: 1 }}
              renderItem={({ item }) => (
                <Option currency={item} selected={item.code === value} onPress={() => select(item.code)} />
              )}
              ListEmptyComponent={
                <T muted style={{ paddingVertical: Spacing.three }}>
                  No currency found. You can also type any 3-letter code, like ISK.
                </T>
              }
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Option({ currency, selected, onPress }: { currency: Currency; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={currency.name ? `${currency.name}, ${currency.code}` : `${currency.code}, other currency`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.option, { borderBottomColor: theme.border }, pressed && { opacity: 0.6 }]}>
      <T style={styles.code}>{currency.code}</T>
      <T muted={!currency.name} numberOfLines={1} style={{ flex: 1 }}>
        {currency.name || 'Other currency'}
      </T>
      {selected ? <T color={theme.primary} style={{ fontWeight: '700' }}>✓</T> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius,
    paddingHorizontal: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three, paddingVertical: Spacing.five * 2 },
  dim: { backgroundColor: 'rgba(0, 0, 0, 0.4)' },
  sheet: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    maxHeight: 640,
    borderRadius: Radius,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 48,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  code: { width: 48, fontWeight: '600' },
});
