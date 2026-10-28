import { Card, Chip, ChipRow, T } from '@/components/ui';
import { repeatHint, repeatLabel, type RepeatFrequency } from '@/domain/recurring';
import { todayLocal } from '@/lib/dates';

const OPTIONS: (RepeatFrequency | null)[] = [null, 'weekly', 'monthly', 'yearly'];

/** "Repeat" choice on a new expense: Never, or a schedule that adds the expense again by itself. */
export function RepeatCard({
  value,
  onChange,
  startOn,
}: {
  value: RepeatFrequency | null;
  onChange: (value: RepeatFrequency | null) => void;
  startOn: string;
}) {
  return (
    <Card>
      <T variant="label" muted>Repeat</T>
      <ChipRow>
        {OPTIONS.map((option) => (
          <Chip
            key={option ?? 'never'}
            label={option ? repeatLabel(option) : 'Never'}
            selected={value === option}
            onPress={() => onChange(option)}
          />
        ))}
      </ChipRow>
      {value ? (
        <T variant="small" muted>
          {repeatHint(value, startOn, todayLocal())} You can pause or stop it under &quot;Recurring expenses&quot; on the
          group page.
        </T>
      ) : null}
    </Card>
  );
}
