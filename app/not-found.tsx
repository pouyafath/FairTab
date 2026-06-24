import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="container max-w-md py-24">
      <div className="page-panel p-8 text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-bold">Page not found</h1>
        <p className="mt-4 text-muted-foreground">
          This group link may be invalid or expired. Check the URL and try again.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/groups">My Groups</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
