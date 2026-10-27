'use client'

import { useRef, useState } from 'react'
import { AlertTriangle, DatabaseBackup, FileCheck2, FileDown, RotateCcw } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import type {
  BackupRestoreMode,
  BackupRestoreResult,
  BackupValidationConflict,
  BackupValidationIssue,
  BackupValidationResult,
} from '@/lib/backups/types'
import { REPLACE_BACKUP_CONFIRMATION } from '@/lib/backups/types'

type BackupSummary = BackupValidationResult['summary']
type BackupTable = keyof BackupSummary
type IssueGroup = {
  key: string
  label: string
  total: number
  messages: string[]
}

const tableLabels: Record<keyof BackupValidationResult['summary'], string> = {
  groups: 'Groups',
  groupMembers: 'Members',
  expenses: 'Expenses',
  expenseParticipants: 'Splits',
  settlements: 'Settlements',
  personalTransactions: 'Personal',
}

const tableOrder = Object.keys(tableLabels) as BackupTable[]

function totalRows(summary?: BackupSummary): number {
  if (!summary) return 0
  return Object.values(summary).reduce((total, count) => total + count, 0)
}

function tableFromPath(path?: string): BackupTable | 'general' {
  if (!path) return 'general'

  return (
    tableOrder.find(
      (table) => path.includes(`data.${table}`) || path.includes(`rowCounts.${table}`)
    ) ?? 'general'
  )
}

function issueLabel(key: BackupTable | 'general'): string {
  return key === 'general' ? 'General' : tableLabels[key]
}

function issueMessage(issue: BackupValidationIssue): string {
  return `${issue.path ? `${issue.path}: ` : ''}${issue.message}`
}

function orderedGroups(groups: Map<BackupTable | 'general', string[]>): IssueGroup[] {
  return (['general', ...tableOrder] as Array<BackupTable | 'general'>)
    .map((key) => {
      const messages = groups.get(key) ?? []
      return {
        key,
        label: issueLabel(key),
        total: messages.length,
        messages: messages.slice(0, 5),
      }
    })
    .filter((group) => group.total > 0)
}

function groupIssues(issues: BackupValidationIssue[]): IssueGroup[] {
  const groups = new Map<BackupTable | 'general', string[]>()
  for (const issue of issues) {
    const key = tableFromPath(issue.path)
    groups.set(key, [...(groups.get(key) ?? []), issueMessage(issue)])
  }
  return orderedGroups(groups)
}

function groupConflicts(conflicts: BackupValidationConflict[]): IssueGroup[] {
  const groups = new Map<BackupTable | 'general', string[]>()
  for (const conflict of conflicts) {
    groups.set(conflict.table, [
      ...(groups.get(conflict.table) ?? []),
      `${conflict.identifier}: ${conflict.message}`,
    ])
  }
  return orderedGroups(groups)
}

function ValidationIssueGroups({
  title,
  groups,
}: {
  title: string
  groups: IssueGroup[]
}) {
  if (groups.length === 0) return null

  return (
    <div className="space-y-2">
      <p className="font-medium">{title}</p>
      {groups.map((group) => (
        <div key={group.key} className="rounded-md border bg-background/70 p-2">
          <p className="text-xs font-medium">
            {group.label} ({group.total})
          </p>
          <div className="mt-1 space-y-1">
            {group.messages.map((message) => (
              <p key={message}>{message}</p>
            ))}
            {group.total > group.messages.length && (
              <p className="text-muted-foreground">
                +{group.total - group.messages.length} more
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

async function readError(response: Response): Promise<string> {
  try {
    const payload = await response.json()
    return payload.error ?? payload.message ?? `Request failed with ${response.status}`
  } catch {
    return `Request failed with ${response.status}`
  }
}

function authHeaders(token: string): Record<string, string> {
  const trimmed = token.trim()
  return trimmed ? { Authorization: `Bearer ${trimmed}` } : {}
}

function filenameFromResponse(response: Response): string {
  const disposition = response.headers.get('content-disposition') ?? ''
  const match = disposition.match(/filename="([^"]+)"/i)
  return match?.[1] ?? `fairtab-backup-${new Date().toISOString().slice(0, 10)}.json`
}

export function BackupActions() {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [token, setToken] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const [backupPayload, setBackupPayload] = useState<unknown>(null)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const [replaceConfirmation, setReplaceConfirmation] = useState('')
  const [validation, setValidation] = useState<BackupValidationResult | null>(null)
  const [restoreResult, setRestoreResult] = useState<BackupRestoreResult | null>(null)

  async function handleExport() {
    setIsExporting(true)
    try {
      const response = await fetch('/api/backups/export', {
        headers: authHeaders(token),
      })
      if (!response.ok) throw new Error(await readError(response))

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filenameFromResponse(response)
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)

      toast({ title: 'Backup downloaded', description: 'Store this JSON file somewhere safe.' })
    } catch (error) {
      toast({
        title: 'Backup export failed',
        description: error instanceof Error ? error.message : 'Unexpected export error',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  async function handleValidate(file: File | undefined) {
    if (!file) return

    setIsValidating(true)
    setValidation(null)
    setRestoreResult(null)
    setBackupPayload(null)
    setSelectedFileName(file.name)
    try {
      let payload: unknown
      try {
        payload = JSON.parse(await file.text())
      } catch {
        throw new Error('Selected file is not valid JSON.')
      }

      const response = await fetch('/api/backups/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!('valid' in result)) {
        const message = result.error ?? result.message ?? `Request failed with ${response.status}`
        throw new Error(message)
      }

      setValidation(result)
      setBackupPayload(payload)
      toast({
        title: result.valid ? 'Backup validated' : 'Backup has errors',
        description: result.canRestore
          ? 'Dry-run found no conflicts.'
          : 'Review conflicts or validation errors before restoring.',
        variant: result.valid ? 'default' : 'destructive',
      })
    } catch (error) {
      toast({
        title: 'Restore dry-run failed',
        description: error instanceof Error ? error.message : 'Unexpected validation error',
        variant: 'destructive',
      })
    } finally {
      setIsValidating(false)
    }
  }

  async function handleRestore(mode: BackupRestoreMode) {
    if (!backupPayload) return

    setIsRestoring(true)
    setRestoreResult(null)
    try {
      const response = await fetch('/api/backups/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token),
        },
        body: JSON.stringify({
          backup: backupPayload,
          mode,
          confirmation: mode === 'replace' ? replaceConfirmation : undefined,
        }),
      })

      const result = await response.json()
      setRestoreResult(result)

      if (!response.ok || !result.restored) {
        throw new Error(result.error ?? `Restore failed with ${response.status}`)
      }

      toast({
        title: 'Backup restored',
        description:
          mode === 'replace'
            ? 'Existing FairTab data was replaced by the backup.'
            : 'Backup was restored into an empty database.',
      })
    } catch (error) {
      toast({
        title: 'Restore failed',
        description: error instanceof Error ? error.message : 'Unexpected restore error',
        variant: 'destructive',
      })
    } finally {
      setIsRestoring(false)
    }
  }

  const incomingRows = totalRows(validation?.summary)
  const currentRows = totalRows(validation?.currentSummary)
  const emptyRestoreEligible = validation?.currentSummary
    ? currentRows === 0
    : null
  const conflictGroups = validation ? groupConflicts(validation.conflicts) : []
  const errorGroups = validation ? groupIssues(validation.errors) : []
  const warningGroups = validation ? groupIssues(validation.warnings) : []

  return (
    <div className="min-w-0 space-y-4 rounded-lg border bg-card/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-medium">Full JSON backup</p>
          <p className="text-sm text-muted-foreground">
            Export every group, member, expense split, settlement, and personal transaction.
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <DatabaseBackup className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="backup-token">Backup token (if configured)</Label>
        <Input
          id="backup-token"
          type="password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Bearer token for protected backup routes"
          autoComplete="off"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          type="button"
          className="h-auto min-h-10 whitespace-normal px-3 text-center"
          onClick={handleExport}
          disabled={isExporting}
        >
          <FileDown className="mr-2 h-4 w-4" aria-hidden="true" />
          {isExporting ? 'Preparing backup...' : 'Download JSON backup'}
        </Button>
        <div>
          <Input
            ref={fileInputRef}
            id="backup-restore-file"
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              void handleValidate(event.target.files?.[0])
              event.currentTarget.value = ''
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-10 w-full whitespace-normal px-3 text-center"
            disabled={isValidating}
            onClick={() => fileInputRef.current?.click()}
          >
            <FileCheck2 className="mr-2 h-4 w-4" aria-hidden="true" />
            {isValidating ? 'Validating...' : 'Dry-run restore file'}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Dry-run validation does not write data. Restore execution requires{' '}
        <code className="rounded bg-muted px-1 py-0.5">FAIRTAB_BACKUP_TOKEN</code>.
      </p>

      {validation && (
        <Alert variant={validation.valid ? 'default' : 'destructive'} aria-live="polite">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>
            {validation.canRestore
              ? 'Backup can be restored'
              : validation.valid
                ? 'Backup is valid but has conflicts'
                : 'Backup is not restorable'}
          </AlertTitle>
          <AlertDescription className="space-y-3">
            <div className="rounded-md border bg-background/70 p-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span>
                  Incoming backup:{' '}
                  <span className="font-medium text-foreground">{incomingRows}</span> records
                </span>
                {validation.currentSummary && (
                  <span>
                    Current database:{' '}
                    <span className="font-medium text-foreground">{currentRows}</span> records
                  </span>
                )}
              </div>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="py-1 pr-3 font-medium">Table</th>
                      <th className="py-1 pr-3 font-medium">Backup</th>
                      {validation.currentSummary && (
                        <th className="py-1 font-medium">Current</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {tableOrder.map((table) => (
                      <tr key={table} className="border-t">
                        <td className="py-1 pr-3">{tableLabels[table]}</td>
                        <td className="py-1 pr-3 font-medium text-foreground">
                          {validation.summary[table]}
                        </td>
                        {validation.currentSummary && (
                          <td className="py-1 font-medium text-foreground">
                            {validation.currentSummary[table]}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedFileName && (
              <p className="text-xs text-muted-foreground">Selected file: {selectedFileName}</p>
            )}

            {emptyRestoreEligible !== null && (
              <p
                className={
                  emptyRestoreEligible
                    ? 'rounded-md border border-green-200 bg-green-50 px-2 py-1 text-green-800'
                    : 'rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-900'
                }
              >
                {emptyRestoreEligible
                  ? 'Current database appears empty; empty restore is eligible.'
                  : 'Current database already contains FairTab records; empty restore will be blocked unless replace mode is explicitly confirmed.'}
              </p>
            )}

            <ValidationIssueGroups title="Conflicts with current data" groups={conflictGroups} />
            <ValidationIssueGroups title="Validation errors" groups={errorGroups} />
            <ValidationIssueGroups title="Warnings" groups={warningGroups} />
          </AlertDescription>
        </Alert>
      )}

      {validation?.valid && backupPayload !== null && (
        <div className="space-y-3 rounded-lg border bg-background/70 p-3">
          <div>
            <p className="text-sm font-medium">Restore execution</p>
            <p className="text-xs text-muted-foreground">
              Empty restore only writes when the current database has no FairTab records. Replace
              mode deletes existing records first and requires exact confirmation.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full whitespace-normal"
            disabled={isRestoring}
            onClick={() => void handleRestore('empty')}
          >
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            {isRestoring ? 'Restoring...' : 'Restore into empty database'}
          </Button>

          <div className="space-y-2">
            <Label htmlFor="replace-confirmation">
              Type{' '}
              <code className="rounded bg-muted px-1 py-0.5">
                {REPLACE_BACKUP_CONFIRMATION}
              </code>{' '}
              to replace all data
            </Label>
            <Input
              id="replace-confirmation"
              value={replaceConfirmation}
              onChange={(event) => setReplaceConfirmation(event.target.value)}
              placeholder={REPLACE_BACKUP_CONFIRMATION}
              autoComplete="off"
            />
            <Button
              type="button"
              variant="destructive"
              className="w-full whitespace-normal"
              disabled={isRestoring || replaceConfirmation !== REPLACE_BACKUP_CONFIRMATION}
              onClick={() => void handleRestore('replace')}
            >
              Replace all FairTab data from backup
            </Button>
          </div>
        </div>
      )}

      {restoreResult && (
        <Alert variant={restoreResult.restored ? 'default' : 'destructive'} aria-live="polite">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>{restoreResult.restored ? 'Restore completed' : 'Restore blocked'}</AlertTitle>
          <AlertDescription>
            {restoreResult.restored
              ? `Restored ${Object.values(restoreResult.summary).reduce((total, count) => total + count, 0)} records.`
              : restoreResult.error}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
