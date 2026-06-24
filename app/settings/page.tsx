'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, Download, Upload, Sun, Moon, Monitor, DatabaseBackup, FileDown, ShieldCheck } from 'lucide-react'
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

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Data</CardTitle>
          <CardDescription>
            Download everything as a portable JSON file, or restore a previous backup. Receipt
            files are not inside the backup — they live in the data directory next to the
            database. This endpoint is unauthenticated; anyone who can reach the app can use it.
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

      <Card className="mt-6 overflow-hidden">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <DatabaseBackup className="h-5 w-5" aria-hidden="true" />
          </div>
          <CardTitle>Data safety (advanced, token-gated)</CardTitle>
          <CardDescription>
            FairTab stores only the records you enter. For self-hosted deployments, back up the
            SQLite file before upgrades and confirm health after every deploy. This export covers
            groups, members, expenses, splits, settlements, and personal transactions only —
            recurring rules, savings goals, and attachments are not yet included.
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
