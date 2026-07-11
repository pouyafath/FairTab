import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * Placeholder shown while a form route's server data (group, expense,
 * transaction) is being fetched. Mirrors the card + stacked fields shape of the
 * expense and transaction forms so the swap to the real form is not jarring.
 */
export function FormCardSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="container py-12 max-w-lg">
      <Card>
        <CardHeader className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-28" />
        </CardHeader>
        <CardContent className="space-y-5">
          {Array.from({ length: fields }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    </div>
  )
}
