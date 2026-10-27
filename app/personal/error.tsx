'use client'

import { ErrorState } from '@/components/layout/error-state'

export default function PersonalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const description =
    process.env.NODE_ENV === 'production'
      ? 'Refresh the dashboard and try again. If the problem persists, check database connectivity from /api/health.'
      : error.message ||
        'Refresh the dashboard and try again. If the problem persists, check database connectivity from /api/health.'

  return (
    <ErrorState
      eyebrow="Dashboard recovery"
      title="Personal finance could not load"
      description={description}
      digest={error.digest}
      reset={reset}
    />
  )
}
