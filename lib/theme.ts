import { useSyncExternalStore } from 'react'

export const THEME_KEY = 'fairtab:theme'
export type Theme = 'light' | 'dark' | 'system'

export function readTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const stored = localStorage.getItem(THEME_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

// Same-tab subscribers; the 'storage' event only fires in *other* tabs.
const listeners = new Set<() => void>()

export function writeTheme(value: Theme): void {
  localStorage.setItem(THEME_KEY, value)
  applyTheme(value)
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
 * Hydration-safe access to the stored theme preference: the server snapshot
 * is 'system', and React swaps in the real localStorage value right after
 * hydration without a mismatch.
 */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, readTheme, () => 'system')
}

export function resolvedTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return theme
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', resolvedTheme(theme) === 'dark')
}
