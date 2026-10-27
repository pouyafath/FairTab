import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="container py-8 max-w-2xl space-y-4">
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-lg" />
      ))}
    </div>
  )
}
