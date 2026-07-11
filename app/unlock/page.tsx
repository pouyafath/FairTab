'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

function UnlockForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const resp = await fetch('/api/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      if (resp.ok) {
        const next = searchParams.get('next')
        // Only same-origin relative paths — never redirect off-site
        router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/')
        router.refresh()
      } else {
        const json = await resp.json().catch(() => ({}))
        setError(json.error ?? 'Wrong PIN')
        setPin('')
      }
    } catch {
      setError('Network error — try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        type="password"
        inputMode="numeric"
        placeholder="PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        autoFocus
        required
      />
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" className="w-full" disabled={submitting || pin.length === 0}>
        {submitting ? 'Unlocking…' : 'Unlock'}
      </Button>
    </form>
  )
}

export default function UnlockPage() {
  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 rounded-full bg-muted p-3 w-fit">
            <Lock className="h-5 w-5 text-muted-foreground" />
          </div>
          <CardTitle>FairTab is locked</CardTitle>
          <CardDescription>Enter the access PIN for this instance.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense>
            <UnlockForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
