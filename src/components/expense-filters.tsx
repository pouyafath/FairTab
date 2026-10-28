import { View } from 'react-native';

import { Button, Card, Chip, ChipRow, Empty, Field, T } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { isFiltering, NO_FILTER, payerIds, usedCategories, type ExpenseFilter } from '@/lib/filters';
import type { Expense, Member } from '@/lib/types';

/**
 * Search box and "Paid by" / "Category" choices above a group's expense list.
 * `expenses` is the whole list (to offer choices); `shown` is how many match right now.
 */
export function ExpenseFilters({
  expenses,
  shown,
  filter,
  onChange,
  members,
  myMemberId,
}: {
  expenses: Expense[];
  shown: number;
  filter: ExpenseFilter;
  onChange: (filter: ExpenseFilter) => void;
  members: Map<string, Member>;
  myMemberId?: string;
}) {
  const paid = payerIds(expenses);
  const payers = [...members.values()].filter((m) => paid.has(m.id));
  const categories = usedCategories(expenses);
  const filtering = isFiltering(filter);
  const clear = () => onChange(NO_FILTER);

  return (
    <>
      <Card>
        <Field
          label="Search"
          placeholder="Description, notes or category"
          value={filter.query}
          onChangeText={(query) => onChange({ ...filter, query })}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {/* With one payer, "Paid by" would always show everything. */}
        {payers.length > 1 ? (
          <>
            <T variant="label" muted>Paid by</T>
            <ChipRow>
              {payers.map((m) => (
                <Chip
                  key={m.id}
                  label={m.id === myMemberId ? 'You' : m.display_name}
                  selected={filter.payerId === m.id}
                  onPress={() => onChange({ ...filter, payerId: filter.payerId === m.id ? null : m.id })}
                />
              ))}
            </ChipRow>
          </>
        ) : null}
        {categories.length > 0 ? (
          <>
            <T variant="label" muted>Category</T>
            <ChipRow>
              {categories.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  selected={filter.category === c}
                  onPress={() => onChange({ ...filter, category: filter.category === c ? null : c })}
                />
              ))}
            </ChipRow>
          </>
        ) : null}
        {filtering ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.three }}>
            <T variant="small" muted style={{ flex: 1 }}>
              Showing {shown} of {expenses.length}
            </T>
            <Button title="Clear" variant="secondary" onPress={clear} />
          </View>
        ) : null}
      </Card>
      {filtering && shown === 0 ? (
        <Empty title="Nothing matches">
          <T muted style={{ textAlign: 'center' }}>Try other words, or clear the search and filters to see every expense.</T>
          <Button title="Clear search and filters" variant="secondary" onPress={clear} />
        </Empty>
      ) : null}
    </>
  );
}
