'use client'

import { useState, useMemo, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Paperclip, Upload, X, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { calculateSplits } from '@/lib/calculations/split'
import {
  dateInputToTimestamp,
  formatCurrency,
  dollarsToCentsString,
  centsToInputString,
  timestampToDateInput,
} from '@/lib/formatting'
import { GROUP_CATEGORIES, SPLIT_METHODS } from '@/lib/constants'
import type { Attachment, GroupMember, SplitMethod, ExpenseWithParticipants } from '@/types'
import type { AddExpenseAction, DeleteAttachmentAction, UpdateExpenseAction } from '@/types/actions'

interface Props {
  groupId: number
  groupToken: string
  members: GroupMember[]
  defaultCurrency: string
  addExpenseAction?: AddExpenseAction
  updateExpenseAction?: UpdateExpenseAction
  expense?: ExpenseWithParticipants
  storageEnabled?: boolean
  deleteAttachmentAction?: DeleteAttachmentAction
}

function initialShareValue(p: { shareValue: number }, method: SplitMethod): string {
  return method === 'exact' ? centsToInputString(p.shareValue) : String(p.shareValue)
}

const ACCEPT_TYPES = '.jpg,.jpeg,.png,.webp,.heic,.pdf'

export function ExpenseForm({
  groupId,
  groupToken,
  members,
  defaultCurrency,
  addExpenseAction,
  updateExpenseAction,
  expense,
  storageEnabled,
  deleteAttachmentAction,
}: Props) {
  const router = useRouter()
  const isEdit = Boolean(expense)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // After new expense is saved, we store its id for the upload step
  const [savedExpenseId, setSavedExpenseId] = useState<number | null>(null)

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<Attachment[]>(expense?.attachments ?? [])
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Form state
  const [title, setTitle] = useState(expense?.title ?? '')
  const [amountStr, setAmountStr] = useState(
    expense ? centsToInputString(expense.amount) : ''
  )
  const currency = expense?.currency ?? defaultCurrency
  const [paidById, setPaidById] = useState<string>(
    expense ? String(expense.paidById) : ''
  )
  const [date, setDate] = useState(
    expense ? timestampToDateInput(expense.date) : new Date().toISOString().split('T')[0]
  )
  const [category, setCategory] = useState<string>(expense?.category ?? '')
  const [notes, setNotes] = useState(expense?.notes ?? '')
  const [splitMethod, setSplitMethod] = useState<SplitMethod>(expense?.splitMethod ?? 'equal')

  const [checkedMembers, setCheckedMembers] = useState<Set<number>>(
    expense
      ? new Set(expense.participants.map((p) => p.memberId))
      : new Set(members.map((m) => m.id))
  )
  const [shareValues, setShareValues] = useState<Record<number, string>>(
    expense
      ? Object.fromEntries(
          members.map((m) => {
            const p = expense.participants.find((part) => part.memberId === m.id)
            return [m.id, p ? initialShareValue(p, expense.splitMethod) : '']
          })
        )
      : Object.fromEntries(members.map((m) => [m.id, '']))
  )

  const totalCents = dollarsToCentsString(amountStr)

  const preview = useMemo(() => {
    if (totalCents <= 0) return null
    try {
      const participants =
        splitMethod === 'equal'
          ? Array.from(checkedMembers).map((id) => ({ memberId: id, shareValue: 1 }))
          : members
              .filter((m) => {
                const v = parseInt(shareValues[m.id] ?? '0', 10)
                return !isNaN(v) && v > 0
              })
              .map((m) => ({
                memberId: m.id,
                shareValue:
                  splitMethod === 'exact'
                    ? dollarsToCentsString(shareValues[m.id] ?? '0')
                    : parseInt(shareValues[m.id] ?? '0', 10),
              }))

      if (participants.length === 0) return null
      return calculateSplits(totalCents, splitMethod, participants)
    } catch {
      return null
    }
  }, [totalCents, splitMethod, checkedMembers, shareValues, members])

  function toggleMember(id: number) {
    setCheckedMembers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function setShareValue(memberId: number, value: string) {
    setShareValues((prev) => ({ ...prev, [memberId]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!paidById) {
      setError('Please select who paid')
      return
    }

    const participants =
      splitMethod === 'equal'
        ? [...checkedMembers].map((id) => ({ memberId: id, shareValue: 1 }))
        : members
            .filter((m) => {
              const raw = shareValues[m.id] ?? '0'
              const v =
                splitMethod === 'exact'
                  ? dollarsToCentsString(raw)
                  : parseInt(raw, 10)
              return v > 0
            })
            .map((m) => ({
              memberId: m.id,
              shareValue:
                splitMethod === 'exact'
                  ? dollarsToCentsString(shareValues[m.id] ?? '0')
                  : parseInt(shareValues[m.id] ?? '0', 10),
            }))

    if (participants.length === 0) {
      setError('Select at least one participant')
      return
    }

    const payload = {
      title,
      amount: totalCents,
      currency,
      paidById: parseInt(paidById, 10),
      date: dateInputToTimestamp(date),
      category: category || undefined,
      notes: notes || undefined,
      splitMethod,
      participants,
    }

    startTransition(async () => {
      if (isEdit && expense && updateExpenseAction) {
        const result = await updateExpenseAction(expense.id, payload)
        if (result.success) {
          router.push(`/groups/${groupToken}`)
          router.refresh()
        } else {
          setError(result.error)
        }
      } else if (addExpenseAction) {
        const result = await addExpenseAction(groupId, payload)
        if (result.success) {
          if (storageEnabled) {
            setSavedExpenseId(result.data.id)
          } else {
            router.push(`/groups/${groupToken}`)
            router.refresh()
          }
        } else {
          setError(result.error)
        }
      }
    })
  }

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    const expenseId = savedExpenseId ?? expense?.id
    if (!expenseId) return

    setUploadError(null)
    setUploading(true)

    for (const file of Array.from(files)) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('expenseId', String(expenseId))

      try {
        const resp = await fetch(`/api/groups/${groupToken}/attachments`, {
          method: 'POST',
          body: formData,
        })
        const json = await resp.json()
        if (!resp.ok) {
          setUploadError(json.error ?? 'Upload failed')
        } else {
          setUploadedFiles((prev) => [...prev, json.attachment as Attachment])
        }
      } catch {
        setUploadError('Upload failed — check your connection')
      }
    }

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleDeleteUpload(attachment: Attachment) {
    if (!deleteAttachmentAction) return
    setDeletingId(attachment.id)
    const result = await deleteAttachmentAction(attachment.id)
    setDeletingId(null)
    if (result.success) {
      setUploadedFiles((prev) => prev.filter((a) => a.id !== attachment.id))
    } else {
      setUploadError(result.error)
    }
  }

  // After saving a new expense: show receipt upload step
  if (savedExpenseId !== null) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">Expense saved!</span>
        </div>

        <div className="space-y-3">
          <Label className="text-base font-medium">Attach receipts (optional)</Label>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Uploading…' : 'Choose file'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_TYPES}
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
          </div>

          {uploadError && (
            <Alert variant="destructive">
              <AlertDescription>{uploadError}</AlertDescription>
            </Alert>
          )}

          {uploadedFiles.length > 0 && (
            <div className="space-y-1.5">
              {uploadedFiles.map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-sm">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 truncate">{a.filename}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteUpload(a)}
                    disabled={deletingId === a.id}
                    className="text-muted-foreground hover:text-destructive flex-shrink-0"
                    aria-label="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <Button
          type="button"
          onClick={() => {
            router.push(`/groups/${groupToken}`)
            router.refresh()
          }}
          className="w-full"
        >
          Done
        </Button>
      </div>
    )
  }

  const splitPlaceholder: Record<SplitMethod, string> = {
    equal: '',
    exact: '0.00',
    percentage: '%',
    shares: 'shares',
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic fields */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">What was it for? *</Label>
          <Input
            id="title"
            placeholder="e.g. Dinner at Canoe"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Currency</Label>
            <div className="flex h-9 items-center">
              <Badge variant="secondary" className="text-sm font-medium">
                {currency}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Paid by *</Label>
            <Select value={paidById} onValueChange={setPaidById}>
              <SelectTrigger>
                <SelectValue placeholder="Select member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Select category (optional)" />
            </SelectTrigger>
            <SelectContent>
              {GROUP_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes (optional)</Label>
          <Input
            id="notes"
            placeholder="Any additional details"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      <Separator />

      {/* Split method */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>How to split?</Label>
          <Select value={splitMethod} onValueChange={(v) => setSplitMethod(v as SplitMethod)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SPLIT_METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Participants</Label>
          <Card>
            <CardContent className="p-4 space-y-3">
              {members.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No members in this group yet. Add members first.
                </p>
              )}
              {members.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  {splitMethod === 'equal' ? (
                    <Checkbox
                      id={`member-${m.id}`}
                      checked={checkedMembers.has(m.id)}
                      onCheckedChange={() => toggleMember(m.id)}
                    />
                  ) : (
                    <Checkbox checked disabled className="opacity-0 pointer-events-none" />
                  )}
                  <Label htmlFor={`member-${m.id}`} className="flex-1 cursor-pointer font-normal">
                    {m.name}
                  </Label>
                  {splitMethod !== 'equal' && (
                    <Input
                      type="number"
                      min="0"
                      step={splitMethod === 'exact' ? '0.01' : '1'}
                      placeholder={splitPlaceholder[splitMethod]}
                      value={shareValues[m.id] ?? ''}
                      onChange={(e) => setShareValue(m.id, e.target.value)}
                      className="w-28 text-right"
                    />
                  )}
                  {preview && (
                    <span className="text-sm text-muted-foreground w-20 text-right">
                      {formatCurrency(
                        preview.find((p) => p.memberId === m.id)?.amountCents ?? 0,
                        currency
                      )}
                    </span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {splitMethod === 'percentage' && (
            <p className="text-xs text-muted-foreground">
              Total:{' '}
              {members.reduce((s, m) => s + (parseInt(shareValues[m.id] ?? '0', 10) || 0), 0)}%
              (must equal 100%)
            </p>
          )}
          {splitMethod === 'exact' && totalCents > 0 && (
            <p className="text-xs text-muted-foreground">
              Remaining:{' '}
              {formatCurrency(
                totalCents -
                  members.reduce((s, m) => s + dollarsToCentsString(shareValues[m.id] ?? '0'), 0),
                currency
              )}
            </p>
          )}
        </div>
      </div>

      {/* Receipts section — shown on edit when storage is enabled */}
      {isEdit && storageEnabled && (
        <>
          <Separator />
          <div className="space-y-3">
            <Label className="text-base font-medium">Receipts</Label>

            {uploadedFiles.length > 0 && (
              <div className="space-y-1.5">
                {uploadedFiles.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-sm">
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    <a
                      href={`/api/groups/${groupToken}/attachments/${a.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline truncate flex-1"
                    >
                      {a.filename}
                    </a>
                    {deleteAttachmentAction && (
                      <button
                        type="button"
                        onClick={() => handleDeleteUpload(a)}
                        disabled={deletingId === a.id}
                        className="text-muted-foreground hover:text-destructive flex-shrink-0"
                        aria-label="Remove receipt"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading…' : 'Add receipt'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_TYPES}
                multiple
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </div>

            {uploadError && (
              <Alert variant="destructive">
                <AlertDescription>{uploadError}</AlertDescription>
              </Alert>
            )}
          </div>
        </>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/groups/${groupToken}`)}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !title || totalCents <= 0} className="flex-1">
          {isPending ? (isEdit ? 'Saving…' : 'Adding…') : isEdit ? 'Save Changes' : 'Add Expense'}
        </Button>
      </div>
    </form>
  )
}
