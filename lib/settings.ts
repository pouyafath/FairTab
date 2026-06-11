import { useSyncExternalStore } from 'react'

export const DEFAULT_CURRENCY_KEY = 'fairtab_default_currency'

const VALID = ['CAD', 'USD', 'EUR', 'GBP'] as const

const FALLBACK = 'CAD'

export function readDefaultCurrency(): string {
  if (typeof window === 'undefined') return FALLBACK
  const stored = localStorage.getItem(DEFAULT_CURRENCY_KEY)
  if (stored && (VALID as readonly string[]).includes(stored)) return stored
  return FALLBACK
}

// Same-tab subscribers; the 'storage' event only fires in *other* tabs.
const listeners = new Set<() => void>()

export function writeDefaultCurrency(value: string): void {
  localStorage.setItem(DEFAULT_CURRENCY_KEY, value)
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

/**
 * Hydration-safe access to the stored default currency: the server snapshot
 * is the fallback, and React swaps in the real localStorage value right after
 * hydration without a mismatch.
 */
export function useDefaultCurrency(): string {
  return useSyncExternalStore(subscribe, readDefaultCurrency, () => FALLBACK)
}
