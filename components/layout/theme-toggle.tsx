'use client'

import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme, writeTheme, resolvedTheme } from '@/lib/theme'

// Returns false during SSR / before hydration, true once mounted on the client —
// without a setState-in-effect (keeps the react-hooks lint rule happy) and lets
// us read window.matchMedia only when it actually exists.
function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

export function ThemeToggle() {
  const theme = useTheme()
  const mounted = useMounted()

  if (!mounted) {
    // Reserve the space to avoid a layout shift; no icon until we know the theme.
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Toggle theme" disabled />
    )
  }

  const isDark = resolvedTheme(theme) === 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9"
      onClick={() => writeTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
