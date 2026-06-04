'use client'

import { useState } from 'react'
import { Check, Sun, Moon, Monitor } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { CURRENCIES } from '@/lib/constants'
import { DEFAULT_CURRENCY_KEY, readDefaultCurrency } from '@/lib/settings'
import { THEME_KEY, readTheme, applyTheme, type Theme } from '@/lib/theme'

const THEMES: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
  { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
  { value: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
]

export default function SettingsPage() {
  const { toast } = useToast()
  const [currency, setCurrency] = useState(readDefaultCurrency)
  const [saved, setSaved] = useState(readDefaultCurrency)
  const [theme, setTheme] = useState<Theme>(readTheme)

  function handleSave() {
    localStorage.setItem(DEFAULT_CURRENCY_KEY, currency)
    localStorage.setItem(THEME_KEY, theme)
    applyTheme(theme)
    setSaved(currency)
    toast({ title: 'Settings saved' })
  }

  const isDirty = currency !== saved || theme !== readTheme()

  return (
    <div className="container py-12 max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose how FairTab looks on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={`flex flex-col items-center gap-2 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                  theme === value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'bg-background hover:bg-muted'
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default Currency</CardTitle>
          <CardDescription>
            Used when creating new groups and personal transactions. Stored locally on this device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCurrency(c)}
                className={`flex items-center justify-between rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                  currency === c
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'bg-background hover:bg-muted'
                }`}
              >
                <span>{c}</span>
                {currency === c && <Check className="h-4 w-4" />}
              </button>
            ))}
          </div>

          <Button onClick={handleSave} disabled={!isDirty} className="w-full">
            Save Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
