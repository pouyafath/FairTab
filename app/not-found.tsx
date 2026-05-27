import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="container py-24 text-center max-w-md mx-auto">
      <h1 className="text-4xl font-bold">Page not found</h1>
      <p className="mt-4 text-muted-foreground">
        This group link may be invalid or expired. Check the URL and try again.
      </p>
      <div className="flex gap-3 justify-center mt-8">
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/groups">My Groups</Link>
        </Button>
      </div>
    </div>
  )
}
