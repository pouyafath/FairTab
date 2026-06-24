import type { Metadata, Viewport } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { PWARegister } from '@/components/pwa-register'
import { PWAInstallBanner } from '@/components/pwa-install-banner'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'FairTab — Split expenses, track money, settle fairly',
    template: '%s | FairTab',
  },
  description:
    'Free, privacy-first expense splitting and personal finance tracking. No account required. Built for Canadians.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'FairTab',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    title: 'FairTab',
    description: 'Split expenses, track money, settle fairly. Free forever.',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a735f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className={manrope.className}>
        <div className="relative flex min-h-screen flex-col">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
          >
            Skip to content
          </a>
          <SiteHeader />
          <main id="main-content" className="flex-1" tabIndex={-1}>
            {children}
          </main>
          <SiteFooter />
        </div>
        <Toaster />
        <PWARegister />
        <PWAInstallBanner />
      </body>
    </html>
  )
}
