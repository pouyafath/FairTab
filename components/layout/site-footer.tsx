import Link from 'next/link'
import { Receipt } from 'lucide-react'

export function SiteFooter() {
  return (
    <footer className="border-t py-8 mt-12">
      <div className="container flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Receipt className="h-4 w-4" />
          <span>FairTab — Free forever. No ads. No data selling.</span>
        </div>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy
          </Link>
          <Link href="/settings" className="hover:text-foreground transition-colors">
            Settings
          </Link>
          <span>© {new Date().getFullYear()}</span>
        </nav>
      </div>
    </footer>
  )
}
