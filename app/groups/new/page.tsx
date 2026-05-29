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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { createGroup } from '@/lib/actions/groups'
import { CURRENCIES } from '@/lib/constants'

export default function NewGroupPage() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('CAD')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = await createGroup({ name, currency })
      if (result.success) {
        router.push(`/groups/${result.data.token}`)
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <div className="container py-12 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Create a Group</CardTitle>
          <CardDescription>
            Give your group a name and start splitting expenses. No account required.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                      {c} {c === 'CAD' ? '(Canadian Dollar)' : c === 'USD' ? '(US Dollar)' : c === 'EUR' ? '(Euro)' : '(British Pound)'}
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
              {isPending ? 'Creating…' : 'Create Group'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
