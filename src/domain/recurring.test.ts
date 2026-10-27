import { describe, expect, it } from 'vitest';

import { repeatEnded, repeatHint, repeatLabel, repeatSummary } from './recurring';

const rule = { frequency: 'monthly' as const, interval_count: 1, next_on: '2026-11-01', end_on: null, paused: false };

describe('recurring wording', () => {
  it('labels how often it repeats', () => {
    expect(repeatLabel('weekly')).toBe('Every week');
    expect(repeatLabel('monthly', 1)).toBe('Every month');
    expect(repeatLabel('weekly', 2)).toBe('Every 2 weeks');
    expect(repeatLabel('yearly', 3)).toBe('Every 3 years');
  });

  it('summarizes the next date, a pause or the end', () => {
    expect(repeatSummary(rule)).toBe('Every month · next on 2026-11-01');
    expect(repeatSummary({ ...rule, paused: true })).toBe('Every month · paused');
    expect(repeatSummary({ ...rule, end_on: '2026-12-31' })).toBe('Every month · next on 2026-11-01');
    expect(repeatSummary({ ...rule, end_on: '2026-10-31', paused: true })).toBe('Every month · ended 2026-10-31');
    expect(repeatEnded({ ...rule, end_on: '2026-11-01' })).toBe(false);
    expect(repeatEnded({ ...rule, end_on: '2026-10-31' })).toBe(true);
  });

  it('explains when the first copy is added', () => {
    expect(repeatHint('monthly', '2026-11-01', '2026-10-27')).toBe('The first one is added on 2026-11-01, then every month.');
    expect(repeatHint('weekly', '2026-10-27', '2026-10-27')).toBe('Added today, then every week.');
    expect(repeatHint('yearly', '2026-01-15', '2026-10-27')).toBe('Added for 2026-01-15 and every date since, then every year.');
  });
});
