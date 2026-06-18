'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Download, Upload, Sun, Moon, Monitor } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/components/ui/use-toast'
import { CURRENCIES } from '@/lib/constants'
import { useDefaultCurrency, writeDefaultCurrency } from '@/lib/settings'
import { useTheme, writeTheme, type Theme } from '@/lib/theme'

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

interface PendingRestore {
  doc: unknown
  counts: { label: string; value: number }[]
}

function summarize(doc: Record<string, unknown>): { label: string; value: number }[] {
  const data = (doc.data ?? {}) as Record<string, unknown[]>
  const entries: [string, string][] = [
    ['groups', 'Groups'],
    ['members', 'Members'],
    ['expenses', 'Expenses'],
    ['settlements', 'Settlements'],
    ['personalTransactions', 'Personal transactions'],
    ['recurringRules', 'Recurring rules'],
    ['savingsGoals', 'Savings goals'],
    ['attachments', 'Attachments'],
  ]
  return entries.map(([key, label]) => ({
    label,
    value: Array.isArray(data[key]) ? data[key].length : 0,
  }))
}

export default function SettingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const saved = useDefaultCurrency()
  // null = no unsaved selection; the stored value is the source of truth
  const [selection, setSelection] = useState<string | null>(null)
  const currency = selection ?? saved

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<PendingRestore | null>(null)
  const [confirmText, setConfirmText] = useState('')
  const [restoring, setRestoring] = useState(false)

  const theme = useTheme()

  function handleThemeChange(value: Theme) {
    writeTheme(value)
  }

  function handleSave() {
    writeDefaultCurrency(currency)
    setSelection(null)
    toast({ title: 'Settings saved', description: `Default currency set to ${currency}` })
  }

  async function handleFilePicked(files: FileList | null) {
    if (!files || files.length === 0) return
    try {
      const text = await files[0].text()
      const doc = JSON.parse(text) as Record<string, unknown>
      if (doc.format !== 'fairtab-backup') {
        toast({
          title: 'Not a FairTab backup',
          description: 'Choose a file downloaded from the backup button.',
          variant: 'destructive',
        })
        return
      }
      setConfirmText('')
      setPending({ doc, counts: summarize(doc) })
    } catch {
      toast({
        title: 'Could not read file',
        description: 'The file is not valid JSON.',
        variant: 'destructive',
      })
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleRestore() {
    if (!pending) return
    setRestoring(true)
    try {
      const resp = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending.doc),
      })
      const json = await resp.json()
      if (!resp.ok) {
        toast({ title: 'Restore failed', description: json.error, variant: 'destructive' })
      } else {
        toast({ title: 'Restore complete', description: 'All data has been replaced from the backup.' })
        setPending(null)
        router.refresh()
      }
    } catch {
      toast({ title: 'Restore failed', description: 'Network error.', variant: 'destructive' })
    } finally {
      setRestoring(false)
    }
  }

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
                onClick={() => setSelection(c)}
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

      <Card>
        <CardHeader>
          <CardTitle>Data</CardTitle>
          <CardDescription>
            Download everything as a portable JSON file, or restore a previous backup. Receipt
            files are not inside the backup — they live in the data directory next to the
            database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild variant="outline" className="w-full">
            <a href="/api/backup" download>
              <Download className="h-4 w-4 mr-2" />
              Download backup
            </a>
          </Button>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            Restore from file…
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => handleFilePicked(e.target.files)}
          />

          <p className="text-xs text-muted-foreground text-center">
            Restoring replaces all current data. Download a fresh backup first.
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace all data?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This permanently replaces <strong>everything</strong> in this FairTab instance
                  with the contents of the backup:
                </p>
                <ul className="text-sm grid grid-cols-2 gap-x-4 gap-y-1">
                  {pending?.counts.map((c) => (
                    <li key={c.label} className="flex justify-between">
                      <span>{c.label}</span>
                      <span className="font-medium tabular-nums">{c.value}</span>
                    </li>
                  ))}
                </ul>
                <p>
                  Type <strong>RESTORE</strong> to confirm.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="RESTORE"
            autoFocus
          />
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={restoring}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRestore}
              disabled={confirmText !== 'RESTORE' || restoring}
            >
              {restoring ? 'Restoring…' : 'Replace all data'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
