'use client'

import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="container py-24 text-center max-w-md mx-auto">
      <h2 className="text-2xl font-bold">Something went wrong</h2>
      <p className="mt-3 text-muted-foreground">{error.message || 'An unexpected error occurred.'}</p>
      <Button onClick={reset} className="mt-8">
        Try again
      </Button>
    </div>
  )
}
