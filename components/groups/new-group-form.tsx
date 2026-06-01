'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CURRENCIES } from '@/lib/constants'
import { readDefaultCurrency } from '@/lib/settings'
import type { CreateGroupAction } from '@/types/actions'

interface Props {
  createGroupAction: CreateGroupAction
}

export function NewGroupForm({ createGroupAction }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState(readDefaultCurrency)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await createGroupAction({ name, currency })
      if (result.success) {
        router.push(`/groups/${result.data.token}`)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="group-name">Group Name *</Label>
        <Input
          id="group-name"
          placeholder="e.g. Montreal Trip, House Expenses"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <Label>Default Currency</Label>
        <Select value={currency} onValueChange={setCurrency}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}{' '}
                {c === 'CAD'
                  ? '(Canadian Dollar)'
                  : c === 'USD'
                    ? '(US Dollar)'
                    : c === 'EUR'
                      ? '(Euro)'
                      : '(British Pound)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" disabled={isPending || !name.trim()} className="w-full">
        {isPending ? 'Creating...' : 'Create Group'}
      </Button>
    </form>
  )
}
