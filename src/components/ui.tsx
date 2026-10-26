import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { formatMoney } from '@/domain';
import { useTheme } from '@/hooks/use-theme';
import type { Amounts } from '@/lib/ledger';

export function Screen({
  children,
  refreshing,
  onRefresh,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}>
      <View style={styles.content}>{children}</View>
    </ScrollView>
  );
}

type Variant = 'title' | 'heading' | 'body' | 'small' | 'label';

export function T({ variant = 'body', muted, color, style, ...rest }: TextProps & { variant?: Variant; muted?: boolean; color?: string }) {
  const theme = useTheme();
  return (
    <Text
      style={[styles[variant], { color: color ?? (muted ? theme.textSecondary : theme.text) }, style]}
      {...rest}
    />
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }, style]}>{children}</View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}) {
  const theme = useTheme();
  const bg = variant === 'primary' ? theme.primary : 'transparent';
  const fg = variant === 'primary' ? theme.primaryText : variant === 'danger' ? theme.danger : theme.primary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: variant === 'primary' ? bg : theme.border },
        (pressed || disabled) && { opacity: 0.6 },
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, error, style, ...props }: TextInputProps & { label: string; error?: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.one }}>
      <T variant="label" muted>
        {label}
      </T>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text, borderColor: error ? theme.danger : theme.border, backgroundColor: theme.card }, style]}
        {...props}
      />
      {error ? <T variant="small" color={theme.danger}>{error}</T> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: selected ? theme.primary : theme.border, backgroundColor: selected ? theme.primary : theme.card },
      ]}>
      <Text style={{ color: selected ? theme.primaryText : theme.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function ListRow({
  title,
  subtitle,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { borderBottomColor: theme.border }, pressed && { opacity: 0.6 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <T numberOfLines={1}>{title}</T>
        {subtitle ? (
          <T variant="small" muted numberOfLines={1}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

const LABELS = {
  friend: ['owes you ', 'you owe '],
  self: ['you are owed ', 'you owe '],
  member: ['gets back ', 'owes '],
} as const;

/**
 * Shows amounts like "owes you $5" or "you owe €3", one line per currency. Positive = money coming back.
 * mode: friend (another person relative to me), self (my own total), member (a person in a group).
 */
export function BalanceText({
  amounts,
  align = 'right',
  mode = 'friend',
}: {
  amounts: Amounts;
  align?: 'left' | 'right';
  mode?: keyof typeof LABELS;
}) {
  const theme = useTheme();
  const entries = Object.entries(amounts).filter(([, v]) => v !== 0);
  if (entries.length === 0) {
    return <T variant="small" muted style={{ textAlign: align }}>settled up</T>;
  }
  return (
    <View style={{ alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
      {entries.map(([currency, v]) => (
        <T key={currency} variant="small" color={v > 0 ? theme.positive : theme.negative} style={{ fontWeight: '600' }}>
          {LABELS[mode][v > 0 ? 0 : 1]}
          {formatMoney(Math.abs(v), currency)}
        </T>
      ))}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ padding: Spacing.five, alignItems: 'center' }}>
      <ActivityIndicator />
    </View>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  const theme = useTheme();
  if (!error) return null;
  const message = typeof error === 'object' && error && 'message' in error ? String(error.message) : String(error);
  return <T variant="small" color={theme.danger}>{message}</T>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.five }}>
      <T variant="heading" style={{ textAlign: 'center' }}>{title}</T>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { padding: Spacing.three, paddingBottom: Spacing.five * 2, alignItems: 'center' },
  content: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.three },
  title: { fontSize: 28, fontWeight: '700' },
  heading: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 16 },
  small: { fontSize: 14 },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { borderRadius: Radius, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.three, gap: Spacing.two },
  button: {
    minHeight: 48,
    borderRadius: Radius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  input: { minHeight: 48, borderWidth: 1, borderRadius: Radius, paddingHorizontal: Spacing.three, fontSize: 16 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
