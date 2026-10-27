'use client'

import { ErrorState } from '@/components/layout/error-state'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const description =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred while loading this page.'
      : error.message || 'An unexpected error occurred while loading this page.'

  return (
    <ErrorState
      title="Something went wrong"
      description={description}
      digest={error.digest}
      reset={reset}
    />
  )
}
