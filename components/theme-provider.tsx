'use client'

import { useEffect } from 'react'
import { readTheme, applyTheme } from '@/lib/theme'

export function ThemeProvider() {
  useEffect(() => {
    applyTheme(readTheme())

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme(readTheme())
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return null
}
