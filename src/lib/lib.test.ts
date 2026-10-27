import { describe, expect, it } from 'vitest';

import { isValidDate, todayLocal } from './dates';
import { paymentRequestMessage } from './messages';

describe('dates', () => {
  it('formats today in local time', () => {
    const d = new Date();
    expect(todayLocal()).toBe(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
  });
  it('validates real calendar dates', () => {
    expect(isValidDate('2026-02-28')).toBe(true);
    expect(isValidDate('2026-02-30')).toBe(false);
    expect(isValidDate('2026-2-3')).toBe(false);
  });
});

describe('paymentRequestMessage', () => {
  it('uses Interac e-Transfer wording for CAD', () => {
    expect(paymentRequestMessage(2550, 'CAD', 'Sara', 'Cottage')).toBe(
      'Please send $25.50 to Sara via Interac e-Transfer for Cottage expenses.',
    );
  });
  it('uses neutral wording for other currencies', () => {
    expect(paymentRequestMessage(1000, 'EUR', 'Ali', 'Rome')).toMatch(/^Please send .*10\.00.* to Ali for Rome expenses\.$/);
  });
});
