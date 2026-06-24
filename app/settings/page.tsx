'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Sun, Moon, Monitor, DatabaseBackup, FileDown, ShieldCheck } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BackupActions } from '@/components/settings/backup-actions'
import { useToast } from '@/components/ui/use-toast'
import { CURRENCIES } from '@/lib/constants'
import { useDefaultCurrency, writeDefaultCurrency } from '@/lib/settings'
import { useTheme, writeTheme, type Theme } from '@/lib/theme'

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

export default function SettingsPage() {
  const { toast } = useToast()
  const saved = useDefaultCurrency()
  // null = no unsaved selection; the stored value is the source of truth
  const [selection, setSelection] = useState<string | null>(null)
  const currency = selection ?? saved

  const theme = useTheme()

  function handleThemeChange(value: Theme) {
    writeTheme(value)
  }

  function handleSave() {
    writeDefaultCurrency(currency)
    setSelection(null)
    toast({ title: 'Settings saved', description: `Default currency set to ${currency}` })
  }

  return (
    <div className="container max-w-2xl py-12">
      <div className="mb-6">
        <p className="section-kicker mb-2">Device preferences</p>
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Choose how FairTab looks on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleThemeChange(value)}
                className={`flex flex-col items-center gap-2 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                  theme === value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'bg-background hover:bg-muted'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6 overflow-hidden">
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
                onClick={() => setSelection(c)}
                className={`flex items-center justify-between rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                  currency === c
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'bg-card/80 hover:bg-muted'
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

      <Card className="mt-6 overflow-hidden">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <DatabaseBackup className="h-5 w-5" aria-hidden="true" />
          </div>
          <CardTitle>Backup and restore</CardTitle>
          <CardDescription>
            Export a full JSON backup of everything you have entered — groups, members, expenses,
            splits, settlements, personal transactions, recurring rules, savings goals, and
            attachment records — or restore one below. Receipt file bytes live in the data directory
            next to the database, so also back up the `./data` folder to capture them. Export and
            restore both require `FAIRTAB_BACKUP_TOKEN` to be configured.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/35 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Recommended upgrade habit</p>
            <p className="mt-1">
              Copy `fairtab.db` before pulling a new version, run migrations, then check the health
              endpoint for database and migration status.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button variant="outline" asChild>
              <Link href="/personal">
                <FileDown className="mr-2 h-4 w-4" aria-hidden="true" />
                Export personal CSV
              </Link>
            </Button>
            <Button variant="outline" className="flex-1" asChild>
              <Link href="/api/health" target="_blank">
                <ShieldCheck className="mr-2 h-4 w-4" aria-hidden="true" />
                Open health check
              </Link>
            </Button>
            <Button variant="outline" className="flex-1" asChild>
              <Link href="/privacy">Review privacy model</Link>
            </Button>
          </div>
          <BackupActions />
        </CardContent>
      </Card>
    </div>
  )
}
