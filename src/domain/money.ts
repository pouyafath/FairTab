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
  const normalized = normalizeSeparators(s, currencyDecimals(currency));
  if (normalized === null) return null;
  s = normalized;
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(s)) return null;
  const decimals = currencyDecimals(currency);
  const [whole, frac = ''] = s.split('.');
  if (frac.length > decimals) {
    return Math.round(Number(s) * 10 ** decimals);
  }
  return Number(whole || '0') * 10 ** decimals + Number(frac.padEnd(decimals, '0') || '0');
}

/**
 * Turns "1,234.56", "1.234,56", "12,50" or "1 234" style input into "1234.56" form.
 * Thousands separators are only accepted when they are well formed ("1,234,567"), so typos such
 * as "10.50." or "1..5" are rejected instead of silently becoming a much larger amount.
 */
function normalizeSeparators(s: string, decimals: number): string | null {
  const grouped = (intPart: string, sep: string) =>
    new RegExp(`^[1-9]\\d{0,2}(\\${sep}\\d{3})+$`).test(intPart);
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    // Whichever separator comes last is the decimal separator; the other must be thousands.
    const [decimal, thousands] = lastDot > lastComma ? ['.', ','] : [',', '.'];
    const at = s.lastIndexOf(decimal);
    const intPart = s.slice(0, at);
    const frac = s.slice(at + 1);
    if (!grouped(intPart, thousands) || !/^\d*$/.test(frac)) return null;
    return `${intPart.split(thousands).join('')}.${frac}`;
  }
  const sep = lastDot !== -1 ? '.' : lastComma !== -1 ? ',' : null;
  if (!sep) return s;
  const parts = s.split(sep);
  if (parts.length > 2) {
    // "1,234,567" or "1.234.567": only valid as thousands grouping.
    return grouped(s, sep) ? parts.join('') : null;
  }
  // One separator. "1,234" / "1.234" (1-3 digits, then exactly 3) can only be thousands when the
  // currency has fewer than 3 decimals; anything else is a decimal separator ("12,50", "0.500").
  if (parts[1].length === 3 && /^[1-9]\d{0,2}$/.test(parts[0]) && decimals < 3) return parts.join('');
  return `${parts[0]}.${parts[1]}`;
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
