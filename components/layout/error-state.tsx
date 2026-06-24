'use client'

import Link from 'next/link'
import { AlertTriangle, Home, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorStateProps {
  eyebrow?: string
  title: string
  description: string
  digest?: string
  reset?: () => void
}

export function ErrorState({
  eyebrow = 'Recovery',
  title,
  description,
  digest,
  reset,
}: ErrorStateProps) {
  return (
    <div className="container flex min-h-[60vh] items-center justify-center py-16">
      <div className="page-panel max-w-xl p-6 text-center sm:p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="section-kicker mt-5">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{title}</h1>
        <p className="mt-3 break-words text-sm leading-6 text-muted-foreground">{description}</p>
        {digest && (
          <p className="mt-4 break-words rounded-md bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
            Error digest: {digest}
          </p>
        )}
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          {reset && (
            <Button type="button" onClick={reset}>
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Try again
            </Button>
          )}
          <Button variant="outline" asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" aria-hidden="true" />
              Back home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
