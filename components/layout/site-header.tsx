import Link from 'next/link'
import { ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/88 backdrop-blur-xl supports-[backdrop-filter]:bg-background/72">
      <div className="container flex min-h-16 flex-col gap-3 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:py-0">
        <Link
          href="/"
          className="flex min-w-0 items-center gap-3 text-lg font-bold"
          aria-label="FairTab home"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <ReceiptText className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="truncate">FairTab</span>
        </Link>
        <nav
          aria-label="Primary navigation"
          className="grid w-full grid-cols-3 gap-0.5 rounded-lg border bg-card/70 p-1 shadow-sm sm:flex sm:w-auto sm:items-center"
        >
          <Button variant="ghost" size="sm" asChild>
            <Link href="/groups">Groups</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/personal">Personal</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/privacy">Privacy</Link>
          </Button>
        </nav>
      </div>
    </header>
  )
}
