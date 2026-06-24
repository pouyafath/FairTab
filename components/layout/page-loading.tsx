interface PageLoadingProps {
  title?: string
  rows?: number
}

export function PageLoading({ title = 'Loading', rows = 4 }: PageLoadingProps) {
  return (
    <div className="container max-w-5xl py-8 sm:py-10">
      <div className="page-panel overflow-hidden">
        <div className="bg-foreground p-6 text-background">
          <div className="h-3 w-28 rounded bg-background/20" />
          <div className="mt-4 h-9 w-64 max-w-full rounded bg-background/25" />
          <p className="sr-only">{title}</p>
        </div>
        <div className="space-y-4 p-5">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="rounded-lg border bg-card/80 p-4">
              <div className="h-4 w-1/3 rounded bg-muted" />
              <div className="mt-3 h-3 w-2/3 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
