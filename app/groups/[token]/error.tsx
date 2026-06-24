'use client'

import { ErrorState } from '@/components/layout/error-state'

export default function GroupError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const description =
    process.env.NODE_ENV === 'production'
      ? 'Refresh the group data and try again. If this keeps happening, verify the group token and database health.'
      : error.message ||
        'Refresh the group data and try again. If this keeps happening, verify the group token and database health.'

  return (
    <ErrorState
      eyebrow="Group recovery"
      title="This group could not load"
      description={description}
      digest={error.digest}
      reset={reset}
    />
  )
}
