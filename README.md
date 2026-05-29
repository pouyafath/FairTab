# FairTab

**Split expenses fairly. Track money privately. No account required.**

FairTab is a free, open-source expense-splitting and personal finance app. Built for Canadians — CAD default, Interac e-Transfer messages built in. No subscriptions, no ads, no data selling, ever.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## Features

| Feature | Details |
|---|---|
| **Group expense splitting** | 4 split methods: equal, exact amounts, percentage, shares |
| **Smart settlements** | Greedy minimum-transfer algorithm eliminates redundant payments |
| **Interac e-Transfer** | One-click copy of a ready-to-send Interac message per settlement |
| **Personal finance** | Log income and expenses, monthly summaries, category breakdowns |
| **CSV export** | Download all personal transactions at any time |
| **No account needed** | Groups use a shareable token URL — no sign-up, no passwords |
| **Privacy-first** | No bank connections, no analytics, no data selling |
| **PWA** | Installable on iOS and Android like a native app |

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

→ Full Ubuntu Server setup with Nginx + SSL + backups: [docs/self-hosting.md](docs/self-hosting.md)  
→ Docker details: [docs/docker.md](docs/docker.md)

---

## Documentation

| Doc | Contents |
|---|---|
| [docs/development.md](docs/development.md) | Local setup, env vars, available scripts, dev workflow |
| [docs/self-hosting.md](docs/self-hosting.md) | **Complete Ubuntu Server guide** — exact copy-paste commands |
| [docs/docker.md](docs/docker.md) | Dockerfile, Compose, volumes, updating |
| [docs/cloudflare.md](docs/cloudflare.md) | Cloudflare Pages + D1 deployment |
| [docs/architecture.md](docs/architecture.md) | Tech stack, file structure, data flow, algorithms |
| [docs/database.md](docs/database.md) | Schema, migrations, backup and restore |
| [docs/contributing.md](docs/contributing.md) | How to contribute, commit style, PR process |

---

## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | RSC + Server Actions, no separate API layer |
| Language | TypeScript (strict) | End-to-end type safety |
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
  groups/[token]/           Group dashboard, add expense, settle up
  personal/                 Personal finance dashboard
  privacy/ settings/        Static pages
components/
  ui/                       shadcn/ui base components
  layout/                   Site header and footer
  groups/                   Group splitting components
  expenses/                 Expense form with live split preview
  personal/                 Personal finance components
lib/
  actions/                  Server Actions (all DB mutations live here)
  calculations/             Pure functions: split, balances, settlements, CSV
  db/                       Drizzle schema, relations, dual-mode client
  formatting/               Currency, date, Interac message formatting
  validations/              Zod schemas for every Server Action
types/                      Shared TypeScript types
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

FairTab never connects to your bank. Settlement is manual — we generate the Interac message, you send the money. No analytics, no ads, no data sold. See the [privacy page](/privacy) for the full policy.

---

## Contributing

Contributions are welcome! Please read [docs/contributing.md](docs/contributing.md) before opening a PR.

---

## Roadmap

- [ ] Group management (rename, archive, delete)
- [ ] Receipt image attachments
- [ ] Recurring expenses
- [ ] PWA install prompt
- [ ] Optional authentication (magic link)
- [ ] Multi-currency conversion
- [ ] PostgreSQL / Supabase support

---

## License

[MIT](LICENSE) — free to use, modify, and self-host.

---

*FairTab is not affiliated with Interac Corp. "Interac e-Transfer" is a trademark of Interac Corp.*
