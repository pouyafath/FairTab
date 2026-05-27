import Link from 'next/link'
import { Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <Receipt className="h-6 w-6 text-primary" />
          <span>FairTab</span>
        </Link>
        <nav className="flex items-center gap-1">
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
