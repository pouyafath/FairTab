import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'
import { PWARegister } from '@/components/pwa-register'
import { PWAInstallBanner } from '@/components/pwa-install-banner'

const inter = Inter({ subsets: ['latin'] })

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
  themeColor: '#2563eb',
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
      <body className={inter.className}>
        <div className="relative flex min-h-screen flex-col">
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </div>
        <Toaster />
        <PWARegister />
        <PWAInstallBanner />
      </body>
    </html>
  )
}
