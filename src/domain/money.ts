// Money is always stored as an integer number of minor units (cents) to avoid
// floating point errors. 12.34 USD -> 1234.

const DECIMALS: Record<string, number> = {
  // Zero-decimal currencies (ISO 4217, plus IRR which is used without decimals in practice).
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, IRR: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0,
  PYG: 0, RWF: 0, UGX: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
  // Three-decimal currencies.
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3,
};

export function currencyDecimals(currency: string): number {
  return DECIMALS[currency.toUpperCase()] ?? 2;
}

const LOCAL_DIGITS = /[۰-۹٠-٩]/g;

/** Converts Persian (۰-۹) and Arabic-Indic (٠-٩) digits to ASCII. */
function normalizeDigits(input: string): string {
  return input.replace(LOCAL_DIGITS, (d) => {
    const code = d.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

/**
 * Parses user input like "12.5", "12,50", "1,234.56" or "۱۲۰۰۰" into minor units.
 * Returns null when the input is not a valid non-negative amount.
 */
export function parseAmount(input: string, currency: string): number | null {
  let s = normalizeDigits(input).replace(/[\s٬']/g, '').replace('٫', '.');
  if (!s) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    // Whichever separator comes last is the decimal separator.
    const thousands = lastDot > lastComma ? ',' : '.';
    s = s.split(thousands).join('');
    s = s.replace(',', '.');
  } else if (lastComma !== -1) {
    const parts = s.split(',');
    // "1,234,567" is thousands; "12,50" is a decimal comma.
    s = parts.length > 2 || parts[1].length === 3 && currencyDecimals(currency) !== 3
      ? parts.join('')
      : s.replace(',', '.');
  } else if (lastDot !== -1) {
    const parts = s.split('.');
    // "1.234.567" is thousands. "1.234" can only be thousands too when the currency has fewer
    // than 3 decimals (it is how most of Europe writes 1234), mirroring the comma rule above.
    if (parts.length > 2 || (parts[1].length === 3 && /^[1-9]\d{0,2}$/.test(parts[0]) && currencyDecimals(currency) < 3)) {
      s = parts.join('');
    }
  }
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(s)) return null;
  const decimals = currencyDecimals(currency);
  const [whole, frac = ''] = s.split('.');
  if (frac.length > decimals) {
    return Math.round(Number(s) * 10 ** decimals);
  }
  return Number(whole || '0') * 10 ** decimals + Number(frac.padEnd(decimals, '0') || '0');
}

/** Formats minor units for display, e.g. formatMoney(1234, 'USD') -> "$12.34". */
export function formatMoney(minor: number, currency: string, locale?: string): string {
  const decimals = currencyDecimals(currency);
  const value = minor / 10 ** decimals;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  } catch {
    return `${value.toFixed(decimals)} ${currency}`;
  }
}

/** Converts minor units to a plain decimal string suitable for an input field. */
export function toInputString(minor: number, currency: string): string {
  const decimals = currencyDecimals(currency);
  return (minor / 10 ** decimals).toFixed(decimals);
}

/**
 * Splits `total` into integer parts proportional to `weights` using the largest
 * remainder method, so the parts always add up to exactly `total`.
 * Ties are broken by position (earlier entries get the extra cent first).
 */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0 || sum <= 0) throw new Error('allocate: weights must sum to more than zero');
  const exact = weights.map((w) => (total * w) / sum);
  const parts = exact.map(Math.floor);
  let remainder = total - parts.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; remainder > 0; k = (k + 1) % order.length, remainder--) {
    parts[order[k].i] += 1;
  }
  return parts;
}
