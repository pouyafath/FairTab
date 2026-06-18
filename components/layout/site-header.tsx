'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Receipt } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { MobileNav } from '@/components/layout/mobile-nav'
import { NAV_LINKS, isNavActive } from '@/components/layout/nav'

export function SiteHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl">
          <Receipt className="h-6 w-6 text-primary" />
          <span>FairTab</span>
        </Link>
        <div className="flex items-center gap-1">
          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 sm:flex">
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
