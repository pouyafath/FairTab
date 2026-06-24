import Link from 'next/link'
import { ReceiptText } from 'lucide-react'

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t bg-card/35 py-8">
      <div className="container flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="flex h-8 w-8 items-center justify-center rounded-md border bg-card text-primary">
            <ReceiptText className="h-4 w-4" />
          </span>
          <span>Free forever. No ads. No data selling.</span>
        </div>
        <nav className="flex items-center gap-4 text-sm font-medium text-muted-foreground">
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
