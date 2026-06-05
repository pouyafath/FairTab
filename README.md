# FairTab

**Split expenses fairly. Track money privately. No account required.**

FairTab is a free, open-source expense-splitting and personal finance app. Built for Canadians — CAD default, Interac e-Transfer messages built in. No subscriptions, no ads, no data selling, ever.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

---

## What FairTab Does

FairTab combines two simple workflows in one application:

- **Shared groups** for recording expenses, calculating balances, and suggesting who should pay whom
- **Personal finance** for manually recording income and expenses, reviewing monthly summaries, and exporting transactions

It does not connect to banks or process payments. FairTab is best suited to trusted groups and
private or self-hosted personal use.

> **Current access model:** FairTab has no authentication or user accounts. Anyone with a group
> link can manage that group, and the personal dashboard is shared across the entire deployment.
> Read [docs/project-overview.md](docs/project-overview.md) before using a public instance.

---

## Features

| Feature | Details |
|---|---|
| **Group expense splitting** | 4 split methods: equal, exact amounts, percentage, shares |
| **Group management** | Rename or delete groups, and edit or remove members without referenced expenses |
| **Expense management** | Edit or delete group expenses after they are created |
| **Smart settlements** | Inline suggestions, payment history, and undo support |
| **Interac e-Transfer** | One-click copy of a ready-to-send settlement message |
| **Personal finance** | Add, edit, and delete transactions; review monthly summaries and spending trends |
| **CSV export** | Download all personal transactions at any time |
| **Default currency setting** | Pick a device-local default currency for new groups and transactions |
| **No account needed** | Groups use a shareable token URL; recently visited groups stay in browser storage |
| **Privacy-first** | No bank connections, no analytics, no data selling |
| **PWA** | Installable on iOS and Android like a native app |

---

## How Group Splitting Works

1. Create a group and choose its currency.
2. Add members and share the group link or token.
3. Record expenses, who paid, and how each expense should be split.
4. Review balances and settlement suggestions.
5. Settle outside FairTab using Interac e-Transfer, cash, or another payment method.

All amounts are stored as integer cents. FairTab supports CAD, USD, EUR, and GBP, but does not
perform currency conversion.

---

## Deployment Options

FairTab runs in three modes — pick the one that fits your needs:

| Mode | Best for | Cost | Data location |
|---|---|---|---|
| [Local dev](#quick-start-local-dev) | Development and testing | Free | Your machine |
| [Self-hosted Docker](#quick-start-docker) | Full control, long-term hosting | Free (your hardware) | Your server |
| [Cloudflare Pages + D1](docs/cloudflare.md) | Zero-maintenance cloud | Free tier | Cloudflare |

---

## Quick Start — Local Dev

```bash
git clone https://github.com/pouyafath/FairTab.git
cd FairTab
npm install
cp .env.example .env.local
npm run db:push      # creates fairtab.db
npm run dev          # http://localhost:3000
```

FairTab targets Node.js 20+ and npm 10+. The repo includes `.nvmrc` for Node version managers.

→ Full guide: [docs/development.md](docs/development.md)

---

## Quick Start — Docker

```bash
git clone https://github.com/pouyafath/FairTab.git
cd FairTab
mkdir -p data
docker compose up -d
```

App is live at **http://localhost:3000**. Data is in `./data/fairtab.db`.

→ Home-server setup, VPN, security, and backups: [pouyafath/Phomeserver](https://github.com/pouyafath/Phomeserver)

→ Docker details: [docs/docker.md](docs/docker.md)

---

## Documentation

| Doc | Contents |
|---|---|
| [docs/project-overview.md](docs/project-overview.md) | Product scope, supported workflows, data model, trust model, and constraints |
| [docs/development.md](docs/development.md) | Local setup, env vars, available scripts, dev workflow |
| [docs/docker.md](docs/docker.md) | Dockerfile, Compose, volumes, updating |
| [docs/cloudflare.md](docs/cloudflare.md) | Cloudflare Pages + D1 deployment |
| [docs/architecture.md](docs/architecture.md) | Tech stack, file structure, data flow, algorithms |
| [docs/database.md](docs/database.md) | Schema, migrations, backup and restore |
| [docs/contributing.md](docs/contributing.md) | How to contribute, commit style, PR process |
| [pouyafath/Phomeserver](https://github.com/pouyafath/Phomeserver) | Home-server OS, VPN, security, monitoring, and host operations |

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | RSC + Server Actions, no separate API layer |
| Language | TypeScript (strict) | End-to-end type safety |
| Backend boundary | Server Actions + backend services | Thin Next adapters over testable use cases |
| Database | SQLite via better-sqlite3 + Drizzle ORM | Zero-config, portable, migrates to D1 |
| UI | Tailwind CSS v3 + shadcn/ui | Accessible components, consistent design tokens |
| Validation | Zod v4 | Runtime validation on all Server Actions |
| PWA | Custom service worker | No extra dependencies |
| Deployment | Docker / Cloudflare Pages | Self-host or serverless, same codebase |

---

## Project Structure

```
app/                        Next.js App Router
  api/health/               Health-check endpoint (used by Docker HEALTHCHECK)
  groups/[token]/           Group dashboard, group settings, expenses, settle up
  personal/                 Personal dashboard and transaction forms
  privacy/ settings/        Privacy policy and device-local settings
components/
  ui/                       shadcn/ui base components
  layout/                   Site header and footer
  groups/                   Dashboard, member list, group settings, settlements
  expenses/                 Expense form/list with edit and delete flows
  personal/                 Personal finance components
lib/
  actions/                  Thin Next.js Server Action adapters
  backend/                  Backend services, ports, and Drizzle repositories
  calculations/             Pure functions: split, balances, settlements, CSV
  db/                       Drizzle schema, relations, dual-mode client
  formatting/               Currency, date, Interac message formatting
  validations/              Zod schemas for every Server Action
types/                      Shared TypeScript types
tests/                      Server-independent backend tests with in-memory repositories
scripts/
  migrate.js                Applies SQL migration (used by Docker entrypoint)
migrations/
  0001_initial.sql          SQLite-compatible schema creation SQL
public/
  manifest.json             PWA manifest
  sw.js                     Service worker
```

---

## Data Model

All monetary amounts stored as **integer cents** (e.g. $24.50 → `2450`).

```
groups               id, name, token(unique), currency, createdAt
group_members        id, groupId → groups, name, email?
expenses             id, groupId, title, amount, paidById, date, category, splitMethod
expense_participants id, expenseId, memberId, shareValue, amountCents (stored — not recalculated)
settlements          id, groupId, fromMemberId, toMemberId, amount, isPaid, paidAt?
personal_transactions id, type, title, amount, currency, date, category, note, accountLabel
```

---

## Available Scripts

```bash
npm run dev           # Development server (http://localhost:3000)
npm run build         # Production build (Next.js + standalone output)
npm run start         # Start production server (after build)
npm run test          # Backend service tests without server/database setup
npm run typecheck     # TypeScript type checking
npm run lint          # ESLint
npm run db:push       # Sync Drizzle schema → SQLite (dev only)
npm run db:studio     # Open Drizzle Studio database browser
npm run db:generate   # Generate Drizzle migration files
npm run db:migrate    # Apply migrations/0001_initial.sql (used by Docker)
npm run pages:build   # Build for Cloudflare Pages (next build + @cloudflare/next-on-pages)
```

---

## Privacy

FairTab never connects to your bank. Settlement is manual — we generate the message, you send
the money. No analytics, no ads, no data sold.

Privacy does not mean access control in the current version: group links are shared secrets, and
personal transactions are instance-wide until authentication is added. See
[docs/project-overview.md](docs/project-overview.md#data-and-trust-model) for details.

---

## Contributing

Contributions are welcome! Please read [docs/contributing.md](docs/contributing.md) before opening a PR.

---

## Roadmap

- [ ] Group archiving
- [ ] Receipt image attachments
- [ ] Recurring expenses
- [ ] PWA install prompt
- [ ] Optional authentication (magic link)
- [ ] Multi-currency conversion
- [ ] PostgreSQL / Supabase support

---

## License

MIT — free to use, modify, and self-host.

---

*FairTab is not affiliated with Interac Corp. "Interac e-Transfer" is a trademark of Interac Corp.*
