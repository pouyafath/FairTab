'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ReceiptText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { MobileNav } from '@/components/layout/mobile-nav'
import { NAV_LINKS, isNavActive } from '@/components/layout/nav'

export function SiteHeader() {
  const pathname = usePathname()

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
        <div className="flex items-center gap-1">
          {/* Desktop nav */}
          <nav aria-label="Primary navigation" className="hidden items-center gap-1 sm:flex">
            {NAV_LINKS.map(({ href, label }) => {
              const active = isNavActive(pathname, href)
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  {label}
                </Link>
              )
            })}
          </nav>
          <ThemeToggle />
          {/* Mobile nav */}
          <div className="sm:hidden">
            <MobileNav pathname={pathname} />
          </div>
        </div>
      </div>
    </header>
  )
}
