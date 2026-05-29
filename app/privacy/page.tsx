import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, Database, Eye, CreditCard, Download, Trash2 } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Privacy Policy' }

export default function PrivacyPage() {
  const sections = [
    {
      icon: Eye,
      title: 'No ads, ever',
      body: 'FairTab is and will remain free with zero advertising. We do not track you, profile you, or sell your attention.',
    },
    {
      icon: Database,
      title: 'No data selling',
      body: 'Your financial data is never shared with or sold to third parties. We do not monetize your information.',
    },
    {
      icon: CreditCard,
      title: 'No bank connections',
      body: 'FairTab never asks for or stores bank credentials, account numbers, or banking passwords. All expense tracking is manual.',
    },
    {
      icon: Shield,
      title: 'No account required',
      body: 'Groups work via a secure random link. You can use the app without creating an account or providing an email address.',
    },
    {
      icon: Download,
      title: 'You own your data',
      body: 'You can export your personal transactions at any time as a CSV file. Your data is yours.',
    },
    {
      icon: Trash2,
      title: 'Data deletion',
      body: 'You can delete individual transactions from your personal dashboard. Full data deletion is on our roadmap.',
    },
  ]

  return (
    <div className="container py-12 max-w-2xl">
      <div className="text-center mb-10">
        <div className="inline-flex rounded-full bg-primary/10 p-4 mb-4">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
          FairTab is built on a simple promise: your financial data belongs to you and only you.
        </p>
      </div>

      <div className="space-y-4">
        {sections.map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardHeader className="pb-2 flex flex-row items-start gap-4 space-y-0">
              <div className="rounded-full bg-muted p-2 flex-shrink-0 mt-1">
                <Icon className="h-4 w-4" />
              </div>
              <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent className="pl-14">
              <p className="text-sm text-muted-foreground">{body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-10 rounded-lg border bg-muted/50 p-6 text-sm text-muted-foreground">
        <p>
          <strong>Settlement note:</strong> FairTab generates Interac e-Transfer messages to help
          you settle up, but it does not process or initiate any payments. All money movement
          happens outside the app, between people.
        </p>
        <p className="mt-3">
          FairTab is open source. The source code can be reviewed to verify these claims. Last
          updated: May 2026.
        </p>
      </div>
    </div>
  )
}
