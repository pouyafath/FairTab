import { describe, expect, it } from 'vitest';

import { CURRENCIES, currencyLabel, findCurrency, searchCurrencies } from './currencies';

const codes = (query: string, pinned?: (string | null | undefined)[]) =>
  searchCurrencies(query, { pinned }).map((c) => c.code);

describe('currency list', () => {
  it('has unique, real ISO 4217 codes', () => {
    const all = CURRENCIES.map((c) => c.code);
    expect(new Set(all).size).toBe(all.length);
    const iso = new Set(Intl.supportedValuesOf('currency'));
    for (const code of all) expect(iso.has(code), code).toBe(true);
  });
  it('includes the currencies people asked for', () => {
    const required = [
      'CAD', 'USD', 'EUR', 'GBP', 'IRR', 'AED', 'TRY', 'AUD', 'NZD', 'JPY', 'CNY', 'HKD', 'SGD', 'INR', 'PKR',
      'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'MXN', 'BRL', 'ARS', 'CLP', 'COP', 'KRW', 'THB', 'IDR',
      'MYR', 'PHP', 'VND', 'ZAR', 'EGP', 'SAR', 'QAR', 'KWD', 'BHD', 'OMR', 'ILS', 'RUB', 'UAH',
    ];
    expect(required).toHaveLength(43);
    for (const code of required) expect(findCurrency(code).name, code).not.toBe('');
  });
  it('labels known and unknown codes', () => {
    expect(currencyLabel('CAD')).toBe('CAD · Canadian dollar');
    expect(currencyLabel('ISK')).toBe('ISK');
  });
});

describe('searchCurrencies', () => {
  it('returns the whole list for an empty query', () => {
    expect(codes('')).toEqual(CURRENCIES.map((c) => c.code));
    expect(codes('   ')).toHaveLength(CURRENCIES.length);
  });
  it('matches codes and names, ignoring case', () => {
    expect(codes('eur')[0]).toBe('EUR');
    expect(codes('EuRo')).toEqual(['EUR']);
    expect(codes('rial')).toEqual(['IRR', 'OMR']);
    expect(codes('swiss')).toEqual(['CHF']);
  });
  it('puts an exact code first, then code prefixes, then name matches', () => {
    // AUD is an exact code match; "Saudi riyal" only contains "aud".
    expect(codes('aud')).toEqual(['AUD', 'SAR']);
    // RUB starts with "ru"; then names with a word starting with it (rupee, rupiah); then "koruna".
    expect(codes('ru')).toEqual(['RUB', 'INR', 'PKR', 'IDR', 'CZK']);
    const us = codes('us');
    expect(us[0]).toBe('USD');
    expect(us).toContain('AUD'); // "Australian" contains "us"
    expect(us.indexOf('USD')).toBeLessThan(us.indexOf('AUD'));
    const dollar = codes('dollar');
    expect(dollar.slice(0, 2)).toEqual(['CAD', 'USD']);
    expect(dollar).not.toContain('EUR');
  });
  it('puts pinned codes first, in the given order, when they match', () => {
    expect(codes('', ['IRR', 'EUR']).slice(0, 3)).toEqual(['IRR', 'EUR', 'CAD']);
    expect(codes('dollar', ['AUD', 'EUR'])[0]).toBe('AUD');
    expect(codes('dollar', ['AUD', 'EUR'])).not.toContain('EUR');
  });
  it('puts a code typed exactly before pinned codes that only partly match', () => {
    // "Saudi riyal" contains "aud", but whoever types "aud" means AUD (Enter picks the first result).
    expect(codes('aud', ['SAR'])).toEqual(['AUD', 'SAR']);
    expect(codes('AUD ', ['SAR', 'AUD'])).toEqual(['AUD', 'SAR']);
    // Also for codes that are not in the list: "Canadian" contains "nad", "krona/krone" contain "ron".
    expect(codes('nad', ['CAD'])).toEqual(['NAD', 'CAD']);
    expect(codes('ron', ['NOK', 'SEK'])).toEqual(['RON', 'NOK', 'SEK', 'DKK']);
    // Pinned codes still lead when nothing matches the code exactly.
    expect(codes('riyal', ['SAR'])).toEqual(['SAR', 'QAR']);
    expect(codes('ri', ['SAR'])[0]).toBe('SAR');
  });
  it('ignores empty, invalid and repeated pinned codes', () => {
    const list = codes('', [null, undefined, '', 'nope', 'usd', 'USD']);
    expect(list[0]).toBe('USD');
    expect(list.filter((c) => c === 'USD')).toHaveLength(1);
    expect(list).toHaveLength(CURRENCIES.length);
  });
  it('shows a pinned code that is not in the list', () => {
    expect(searchCurrencies('', { pinned: ['ISK'] })[0]).toEqual({ code: 'ISK', name: '' });
    expect(codes('isk', ['ISK'])).toEqual(['ISK']);
    expect(codes('euro', ['ISK'])).toEqual(['EUR']);
  });
  it('offers a typed 3-letter code that is not in the list', () => {
    expect(searchCurrencies('isk')).toEqual([{ code: 'ISK', name: '' }]);
    expect(codes(' Kes ')).toContain('KES');
    // Codes in the list are not repeated, and other lengths are not offered.
    expect(codes('cad')).toEqual(['CAD']);
    expect(codes('is')).not.toContain('IS');
    expect(codes('iskk')).toEqual([]);
    expect(codes('a1b')).toEqual([]);
  });
});
