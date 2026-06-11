export const DEFAULT_CURRENCY_KEY = 'fairtab_default_currency'

const VALID = ['CAD', 'USD', 'EUR', 'GBP'] as const

export function readDefaultCurrency(): string {
  if (typeof window === 'undefined') return 'CAD'
  const stored = localStorage.getItem(DEFAULT_CURRENCY_KEY)
  if (stored && (VALID as readonly string[]).includes(stored)) return stored
  return 'CAD'
}
