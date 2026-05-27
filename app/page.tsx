import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  TrendingUp,
  Shield,
  Zap,
  DollarSign,
  Globe,
  Receipt,
  ArrowRight,
} from 'lucide-react'

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="container py-20 text-center">
        <Badge variant="secondary" className="mb-4">
          Free forever · No account required
        </Badge>
        <h1 className="text-4xl font-bold tracking-tight sm:text-6xl max-w-3xl mx-auto">
          Split expenses, track money, settle fairly.
        </h1>
        <p className="mt-6 text-xl text-muted-foreground max-w-2xl mx-auto">
          The free, privacy-first app for splitting group expenses and tracking personal spending.
          Built for Canadians — Interac-friendly from day one.
        </p>
        <div className="mt-10 flex gap-4 justify-center flex-wrap">
          <Button size="lg" asChild>
            <Link href="/groups/new">
              <Users className="h-5 w-5 mr-2" />
              Create a Group
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/personal">
              <TrendingUp className="h-5 w-5 mr-2" />
              Track My Finances
            </Link>
          </Button>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="container py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: DollarSign,
              title: 'Free Forever',
              description: 'No subscriptions, no premium tiers, no ads — ever.',
            },
            {
              icon: Shield,
              title: 'Privacy First',
              description: 'No bank connections, no data selling. Your numbers stay yours.',
            },
            {
              icon: Zap,
              title: 'No Account Needed',
              description: 'Create a group instantly, share the link, start splitting.',
            },
            {
              icon: Globe,
              title: 'Canada-First',
              description: 'CAD default, Interac e-Transfer settlement messages built in.',
            },
          ].map(({ icon: Icon, title, description }) => (
            <Card key={title}>
              <CardContent className="pt-6">
                <div className="rounded-full bg-primary/10 p-3 w-fit mb-4">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="container py-16 border-t">
        <h2 className="text-2xl font-bold text-center mb-12">How Group Splitting Works</h2>
        <div className="grid gap-8 sm:grid-cols-3 max-w-3xl mx-auto">
          {[
            {
              step: '1',
              title: 'Create a group',
              description: 'Name your group, add members. Share the link — no sign-up required.',
            },
            {
              step: '2',
              title: 'Add expenses',
              description:
                'Log who paid and split equally, by exact amount, percentage, or shares.',
            },
            {
              step: '3',
              title: 'Settle fairly',
              description:
                'FairTab calculates who owes whom and generates Interac e-Transfer messages.',
            },
          ].map(({ step, title, description }) => (
            <div key={step} className="text-center">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg mb-4">
                {step}
              </div>
              <h3 className="font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Use cases */}
      <section className="container py-16 border-t">
        <h2 className="text-2xl font-bold text-center mb-8">Perfect for</h2>
        <div className="flex flex-wrap gap-3 justify-center">
          {[
            'Roommates',
            'Road trips',
            'Vacations',
            'Families',
            'College students',
            'Shared households',
            'Group dinners',
            'Event planning',
          ].map((tag) => (
            <Badge key={tag} variant="secondary" className="text-sm py-1.5 px-3">
              {tag}
            </Badge>
          ))}
        </div>
      </section>

      {/* Personal finance teaser */}
      <section className="container py-16 border-t">
        <div className="rounded-xl bg-muted p-8 flex flex-col sm:flex-row items-center gap-6 justify-between">
          <div>
            <h2 className="text-xl font-bold mb-2">Also track personal spending</h2>
            <p className="text-muted-foreground">
              Log income and expenses, see your monthly balance, and export to CSV — all in the same app.
            </p>
          </div>
          <Button asChild className="flex-shrink-0">
            <Link href="/personal">
              Get Started
              <ArrowRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Privacy promise */}
      <section className="container py-16 border-t text-center">
        <Receipt className="h-8 w-8 text-primary mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-3">Our Privacy Promise</h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          FairTab never connects to your bank, never runs ads, and never sells your data.
          Expense settlement is manual — we generate the message, you send the transfer.{' '}
          <Link href="/privacy" className="text-primary underline underline-offset-4">
            Read our privacy policy
          </Link>
          .
        </p>
      </section>
    </div>
  )
}
