// Wording for recurring expenses (rent, subscriptions). The schedule itself is computed by the
// database (public.recurring_next_date), so the app only describes it.

export type RepeatFrequency = 'weekly' | 'monthly' | 'yearly';

const UNITS: Record<RepeatFrequency, string> = { weekly: 'week', monthly: 'month', yearly: 'year' };

/** "Every month", "Every 2 weeks". */
export function repeatLabel(frequency: RepeatFrequency, interval = 1): string {
  const unit = UNITS[frequency];
  return interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;
}

interface Schedule {
  frequency: RepeatFrequency;
  interval_count: number;
  next_on: string;
  end_on: string | null;
  paused: boolean;
}

/** True when the last date before end_on has been added. Dates are YYYY-MM-DD, so they compare as text. */
export function repeatEnded(rule: Schedule): boolean {
  return !!rule.end_on && rule.next_on > rule.end_on;
}

/** One line about where a recurring expense stands, e.g. "Every month · next on 2026-11-01". */
export function repeatSummary(rule: Schedule): string {
  const label = repeatLabel(rule.frequency, rule.interval_count);
  if (repeatEnded(rule)) return `${label} · ended ${rule.end_on}`;
  if (rule.paused) return `${label} · paused`;
  return `${label} · next on ${rule.next_on}`;
}

/** Explains, on a new expense, when a repeating copy is added. today is YYYY-MM-DD. */
export function repeatHint(frequency: RepeatFrequency, startOn: string, today: string): string {
  const then = `then ${repeatLabel(frequency).toLowerCase()}`;
  if (startOn > today) return `The first one is added on ${startOn}, ${then}.`;
  if (startOn === today) return `Added today, ${then}.`;
  return `Added for ${startOn} and every date since, ${then}.`;
}

/**
 * How many dates from `startOn` up to `today` (both YYYY-MM-DD) a new recurring expense adds right
 * away. Used to ask before a start date in the past adds several expenses at once.
 */
export function datesDueNow(startOn: string, today: string, frequency: RepeatFrequency): number {
  if (startOn > today) return 0;
  const [sy, sm, sd] = startOn.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  if (frequency === 'weekly') {
    const days = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(sy, sm - 1, sd)) / 86400000);
    return Math.floor(days / 7) + 1;
  }
  // Month ends count as reached on the last day of shorter months (Jan 31 -> Feb 28), like the database.
  const lastDay = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  const dayReached = td >= Math.min(sd, lastDay);
  if (frequency === 'monthly') return (ty - sy) * 12 + (tm - sm) + (dayReached ? 1 : 0);
  return ty - sy + (tm > sm || (tm === sm && dayReached) ? 1 : 0);
}
