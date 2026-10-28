// Common currencies for the currency picker. Any other 3-letter code (ISO 4217) can still be typed in its search box.
export interface Currency {
  code: string;
  /** Empty for a code that is not in the list below. */
  name: string;
}

export const CURRENCIES: readonly Currency[] = [
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'USD', name: 'US dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British pound' },
  { code: 'IRR', name: 'Iranian rial' },
  { code: 'AED', name: 'UAE dirham' },
  { code: 'TRY', name: 'Turkish lira' },
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'NZD', name: 'New Zealand dollar' },
  { code: 'JPY', name: 'Japanese yen' },
  { code: 'CNY', name: 'Chinese yuan' },
  { code: 'HKD', name: 'Hong Kong dollar' },
  { code: 'TWD', name: 'Taiwan dollar' },
  { code: 'KRW', name: 'South Korean won' },
  { code: 'SGD', name: 'Singapore dollar' },
  { code: 'INR', name: 'Indian rupee' },
  { code: 'PKR', name: 'Pakistani rupee' },
  { code: 'AFN', name: 'Afghan afghani' },
  { code: 'CHF', name: 'Swiss franc' },
  { code: 'SEK', name: 'Swedish krona' },
  { code: 'NOK', name: 'Norwegian krone' },
  { code: 'DKK', name: 'Danish krone' },
  { code: 'PLN', name: 'Polish zloty' },
  { code: 'CZK', name: 'Czech koruna' },
  { code: 'HUF', name: 'Hungarian forint' },
  { code: 'RUB', name: 'Russian ruble' },
  { code: 'UAH', name: 'Ukrainian hryvnia' },
  { code: 'MXN', name: 'Mexican peso' },
  { code: 'BRL', name: 'Brazilian real' },
  { code: 'ARS', name: 'Argentine peso' },
  { code: 'CLP', name: 'Chilean peso' },
  { code: 'COP', name: 'Colombian peso' },
  { code: 'THB', name: 'Thai baht' },
  { code: 'IDR', name: 'Indonesian rupiah' },
  { code: 'MYR', name: 'Malaysian ringgit' },
  { code: 'PHP', name: 'Philippine peso' },
  { code: 'VND', name: 'Vietnamese dong' },
  { code: 'ZAR', name: 'South African rand' },
  { code: 'EGP', name: 'Egyptian pound' },
  { code: 'SAR', name: 'Saudi riyal' },
  { code: 'QAR', name: 'Qatari riyal' },
  { code: 'KWD', name: 'Kuwaiti dinar' },
  { code: 'BHD', name: 'Bahraini dinar' },
  { code: 'OMR', name: 'Omani rial' },
  { code: 'IQD', name: 'Iraqi dinar' },
  { code: 'ILS', name: 'Israeli shekel' },
];

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));
const CODE = /^[A-Z]{3}$/;

/** The list entry for a code, or a custom entry without a name for codes not in the list. */
export function findCurrency(code: string): Currency {
  return BY_CODE.get(code) ?? { code, name: '' };
}

/** "CAD · Canadian dollar", or just the code when it is not in the list. */
export function currencyLabel(code: string): string {
  const { name } = findCurrency(code);
  return name ? `${code} · ${name}` : code;
}

/** Lower is a better match: exact code, code prefix, word prefix of the name, anywhere else. */
function matchRank(c: Currency, q: string): number | null {
  const code = c.code.toLowerCase();
  const name = c.name.toLowerCase();
  if (code === q) return 0;
  if (code.startsWith(q)) return 1;
  if (name.split(/\s+/).some((word) => word.startsWith(q))) return 2;
  if (code.includes(q) || name.includes(q)) return 3;
  return null;
}

/**
 * Currencies whose code or name matches `query` (case-insensitive), best matches first.
 * A code typed exactly comes first (so pressing Enter picks it), then `pinned` codes
 * (e.g. the current choice, the group's or your default), then everything else.
 * A query that is a 3-letter code not in the list is offered as a custom entry.
 */
export function searchCurrencies(
  query: string,
  { pinned = [] }: { pinned?: readonly (string | null | undefined)[] } = {},
): Currency[] {
  const q = query.trim().toLowerCase();
  const pinnedCodes = [...new Set(pinned.map((p) => (p ?? '').trim().toUpperCase()).filter((p) => CODE.test(p)))];
  const candidates = [...pinnedCodes.filter((p) => !BY_CODE.has(p)).map(findCurrency), ...CURRENCIES];
  const typed = q.toUpperCase();
  if (CODE.test(typed) && !candidates.some((c) => c.code === typed)) candidates.push({ code: typed, name: '' });

  const pinnedOrder = (c: Currency) => {
    const i = pinnedCodes.indexOf(c.code);
    return i === -1 ? pinnedCodes.length : i;
  };
  return candidates
    .flatMap((c, order) => {
      const rank = q ? matchRank(c, q) : 0;
      return rank === null ? [] : [{ c, order, rank, exact: c.code.toLowerCase() === q }];
    })
    .sort(
      (a, b) =>
        Number(b.exact) - Number(a.exact) || pinnedOrder(a.c) - pinnedOrder(b.c) || a.rank - b.rank || a.order - b.order,
    )
    .map((m) => m.c);
}
