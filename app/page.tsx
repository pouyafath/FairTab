import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  TrendingUp,
  Shield,
  WalletCards,
  ArrowRightLeft,
  Receipt,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <section className="container grid min-h-[calc(100vh-4rem)] items-center gap-10 py-12 lg:grid-cols-[0.92fr_1.08fr] lg:py-16">
        <div className="max-w-xl">
          <Badge variant="secondary" className="mb-5 border-primary/15 bg-card/80">
            Free forever · No account required
          </Badge>
          <h1 className="text-5xl font-bold leading-[1.02] sm:text-6xl lg:text-7xl">
            FairTab
          </h1>
          <p className="mt-5 text-xl font-semibold text-foreground sm:text-2xl">
            Split expenses, track money, settle fairly.
          </p>
          <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
            A privacy-first finance workspace for trusted groups and personal spending.
            CAD-first, Interac-friendly, and built without bank connections or accounts.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/groups/new">
                <Users className="mr-2 h-5 w-5" />
                Create a Group
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/personal">
                <TrendingUp className="mr-2 h-5 w-5" />
                Personal Dashboard
              </Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            {['No ads', 'No bank link', 'Manual settlement'].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="page-panel overflow-hidden">
          <div className="border-b bg-foreground px-5 py-4 text-background">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Montreal Trip</p>
                <p className="text-xs text-background/65">4 members · CAD</p>
              </div>
              <Badge className="border-white/10 bg-white/10 text-background hover:bg-white/10">
                Live balance
              </Badge>
            </div>
          </div>
          <div className="grid gap-0 md:grid-cols-[1fr_0.82fr]">
            <div className="space-y-4 p-5">
              {[
                ['Cabin rental', 'Paid by Sarah', '$420.00'],
                ['Groceries', 'Paid by Mike', '$86.45'],
                ['Dinner', 'Paid by Ava', '$154.20'],
              ].map(([title, meta, amount]) => (
                <div
                  key={title}
                  className="flex items-center justify-between rounded-lg border bg-background/75 p-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground">{meta}</p>
                  </div>
                  <span className="text-sm font-bold tabular-nums">{amount}</span>
                </div>
              ))}
            </div>
            <div className="border-t bg-muted/45 p-5 md:border-l md:border-t-0">
              <p className="section-kicker mb-4">Settle up</p>
              <div className="space-y-3">
                {[
                  ['Noah', 'Sarah', '$74.11'],
                  ['Ava', 'Mike', '$21.46'],
                ].map(([from, to, amount]) => (
                  <div key={`${from}-${to}`} className="rounded-lg bg-card p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <span>{from}</span>
                        <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                        <span>{to}</span>
                      </div>
                      <span className="font-bold text-primary">{amount}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-lg border border-primary/20 bg-primary/10 p-4">
                <p className="text-sm font-semibold text-primary">Interac message ready</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Payment stays outside FairTab. The app keeps the math and history clear.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-14">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: WalletCards,
              title: 'Shared expenses',
              description: 'Equal, exact, percentage, and shares-based splits.',
            },
            {
              icon: ArrowRightLeft,
              title: 'Clean settlements',
              description: 'Suggested transfers and payment history without processing money.',
            },
            {
              icon: TrendingUp,
              title: 'Personal finance',
              description: 'Track income, spending, monthly trends, and exportable records.',
            },
            {
              icon: Shield,
              title: 'Private by default',
              description: 'No analytics, no ads, no bank credentials, no account database.',
            },
          ].map(({ icon: Icon, title, description }) => (
            <div key={title} className="page-panel p-5">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="text-base font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="container py-14">
        <div className="grid items-center gap-8 border-y py-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="section-kicker mb-3">Workflows</p>
            <h2 className="text-3xl font-bold">Built for repeated use, not setup ceremonies.</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['1', 'Create', 'Start a group or open a personal dashboard.'],
              ['2', 'Record', 'Add expenses, participants, notes, and categories.'],
              ['3', 'Settle', 'Review balances, record payments, export history.'],
            ].map(([step, title, description]) => (
              <div key={step} className="rounded-lg bg-card/70 p-5">
                <span className="text-sm font-bold text-primary">{step}</span>
                <h3 className="mt-3 font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-14">
        <div className="page-panel grid gap-6 p-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="section-kicker mb-3">First run</p>
            <h2 className="text-3xl font-bold">Start safely in under a minute.</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              FairTab keeps setup light, but production use still benefits from a simple habit:
              create records intentionally, export when needed, and back up self-hosted databases
              before upgrades.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              'Create a group or personal ledger',
              'Add only the records you need',
              'Back up before self-hosted upgrades',
            ].map((item) => (
              <div key={item} className="rounded-lg border bg-card/70 p-4">
                <CheckCircle2 className="mb-3 h-5 w-5 text-primary" aria-hidden="true" />
                <p className="text-sm font-semibold leading-6">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container py-14">
        <div className="page-panel flex flex-col items-start justify-between gap-6 p-6 sm:flex-row sm:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Your data stays boring.</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                FairTab stores only the records you enter. It never connects to your bank,
                never initiates payments, and never sells data.
              </p>
            </div>
          </div>
          <Button variant="outline" asChild className="flex-shrink-0">
            <Link href="/privacy">
              Privacy policy
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  )
}
