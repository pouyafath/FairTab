'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { CURRENCIES } from '@/lib/constants'
import { DEFAULT_CURRENCY_KEY, readDefaultCurrency } from '@/lib/settings'

export default function SettingsPage() {
  const { toast } = useToast()
  const [currency, setCurrency] = useState(readDefaultCurrency)
  const [saved, setSaved] = useState(readDefaultCurrency)

  function handleSave() {
    localStorage.setItem(DEFAULT_CURRENCY_KEY, currency)
    setSaved(currency)
    toast({ title: 'Settings saved', description: `Default currency set to ${currency}` })
  }

  return (
    <div className="container py-12 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

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

          <Button onClick={handleSave} disabled={currency === saved} className="w-full">
            Save Settings
          </Button>

          {saved && (
            <p className="text-xs text-muted-foreground text-center">
              Current default: <span className="font-medium">{saved}</span>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
