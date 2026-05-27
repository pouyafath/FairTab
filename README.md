# FairTab

**Split expenses, track money, settle fairly.**

FairTab is a free, privacy-first web app for splitting shared expenses and tracking personal spending. Built for Canadians — CAD default, Interac e-Transfer settlement messages included.

## Why FairTab?

- **Free forever** — no subscriptions, no premium tiers
- **No ads** — ever
- **No account required** — group splitting works with a shareable link
- **Privacy-first** — no bank connections, no data selling
- **Canada-first** — CAD default, Interac-friendly settlement messages
- **Simple personal finance** — track income and expenses alongside group splits

## Features (MVP)

- **Group expense splitting**: create groups, add members, split expenses equally, by exact amount, by percentage, or by shares
- **Smart settlement**: calculates minimum number of transfers to settle the group
- **Interac e-Transfer messages**: copy a ready-to-send message for each settlement
- **Personal finance tracking**: log income and expenses, view monthly summaries and category breakdowns
- **CSV export**: download your personal transactions anytime
- **PWA-ready**: installable on mobile devices

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict) |
| Database | SQLite via `better-sqlite3` + Drizzle ORM |
| UI | Tailwind CSS v3 + shadcn/ui |
| Validation | Zod |
| PWA | Custom service worker |

## Local Setup

### Prerequisites

- Node.js 18+
- npm

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/pouyafath/fairtab.git
cd fairtab

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local if needed (defaults work for local dev)

# 4. Create the database and run migrations
npm run db:push

# 5. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
npm run typecheck    # TypeScript type checking
npm run db:push      # Apply schema changes to the database
npm run db:studio    # Open Drizzle Studio (database browser)
npm run db:generate  # Generate migration files
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `./fairtab.db` | SQLite database file path |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Public app URL |

## Project Structure

```
app/                    Next.js App Router pages
components/
  ui/                   shadcn/ui base components
  layout/               Header and footer
  groups/               Group splitting components
  expenses/             Expense form and list
  personal/             Personal finance components
lib/
  actions/              Server Actions (database mutations)
  calculations/         Pure calculation logic (split, balances, export)
  db/                   Drizzle schema, relations, and client
  formatting/           Currency and date formatting
  validations/          Zod validation schemas
types/                  Shared TypeScript types
public/                 Static assets, PWA manifest, service worker
```

## Data Model

All monetary amounts are stored as **integer cents** (e.g. $24.50 → `2450`).

```
groups              → id, name, token, currency, createdAt
groupMembers        → id, groupId, name, email?
expenses            → id, groupId, title, amount, paidById, date, category, splitMethod
expenseParticipants → id, expenseId, memberId, shareValue, amountCents
settlements         → id, groupId, fromMemberId, toMemberId, amount, isPaid, paidAt
personalTransactions → id, type, title, amount, currency, date, category, note, accountLabel
```

## Roadmap

### Milestone 2
- [ ] Exact / percentage / share split UI polish
- [ ] Receipt image placeholder upload
- [ ] Recurring expenses
- [ ] Group management (rename, delete)
- [ ] PWA install prompt

### Milestone 3
- [ ] Optional authentication (email/magic link)
- [ ] Multiple personal finance profiles
- [ ] Deployment guides (Vercel, Cloudflare Pages + D1)
- [ ] PostgreSQL / Supabase migration

### Future
- [ ] Native iOS / Android apps
- [ ] Offline-first sync
- [ ] Multi-currency conversion
- [ ] Group activity history

## Privacy

FairTab never connects to your bank, never runs ads, and never sells your data. Expense settlement is manual — we generate the Interac e-Transfer message, you send the money. See `/privacy` for the full policy.

## Contributing

Contributions are welcome! Please open an issue first to discuss significant changes.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes with clear messages
4. Open a pull request

## License

MIT License. See `LICENSE` for details.

---

*FairTab is not affiliated with Interac Corp. "Interac e-Transfer" is a trademark of Interac Corp.*
