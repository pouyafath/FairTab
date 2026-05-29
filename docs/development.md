# Local Development

## Prerequisites

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **npm 10+** (bundled with Node.js)
- **Git**

Verify:
```bash
node --version   # v20.x.x
npm --version    # 10.x.x
```

---

## Setup

```bash
# 1. Clone
git clone https://github.com/pouyafath/FairTab.git
cd FairTab

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# The defaults work out of the box for local dev

# 4. Create and seed the database schema
npm run db:push

# 5. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server with Turbopack (hot reload) |
| `npm run build` | Production build (creates `.next/` and `.next/standalone/`) |
| `npm run start` | Run the production build locally |
| `npm run typecheck` | TypeScript type check (no emit) |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Sync Drizzle schema → SQLite (creates `fairtab.db` if missing) |
| `npm run db:studio` | Open Drizzle Studio at [http://localhost:4983](http://localhost:4983) |
| `npm run db:generate` | Generate SQL migration files from schema changes |
| `npm run db:migrate` | Apply `migrations/0001_initial.sql` (used by Docker, not needed for dev) |
| `npm run pages:build` | Build for Cloudflare Pages (`next build` + `@cloudflare/next-on-pages`) |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `./fairtab.db` | Path to the SQLite database file |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Public URL (used in PWA manifest) |

For local dev, the defaults in `.env.example` work without any changes.

---

## Database Workflow

FairTab uses **Drizzle ORM** with SQLite (`better-sqlite3`).

| Task | Command |
|---|---|
| Apply schema changes during dev | `npm run db:push` |
| Browse data visually | `npm run db:studio` |
| Create a migration file | `npm run db:generate` |
| Reset database | Delete `fairtab.db`, then `npm run db:push` |

The `fairtab.db` file is in `.gitignore` — it's local to your machine.

---

## Project Structure

```
app/                          Pages and API routes (Next.js App Router)
  layout.tsx                  Root layout: Inter font, Toaster, PWA
  page.tsx                    Landing page
  groups/
    page.tsx                  Groups list (recent from localStorage)
    new/page.tsx              Create group form
    [token]/
      page.tsx                Group dashboard (force-dynamic)
      expenses/new/page.tsx   Add expense form
      settlements/page.tsx    Settle up view
  personal/
    page.tsx                  Personal finance dashboard
    transactions/new/page.tsx Add income/expense
  api/health/route.ts         Health check endpoint
  privacy/page.tsx            Privacy policy (static)
  settings/page.tsx           Settings placeholder

components/
  ui/                         shadcn/ui base components
  layout/
    site-header.tsx           Sticky nav bar
    site-footer.tsx
  groups/
    recent-groups.tsx         Client: reads localStorage
    group-dashboard.tsx       Client: tabs for balances/expenses/settle
    balance-summary.tsx       Client: member net balances
    add-member-dialog.tsx     Client: dialog → addGroupMember action
    settlements-view.tsx      Client: copy Interac, mark paid
  expenses/
    expense-form.tsx          Client: full split UI with live preview
    expense-list.tsx          Client: collapsible expense cards
  personal/
    personal-dashboard.tsx    Client: month filter, export, tabs
    summary-cards.tsx         Income / expenses / net cards
    transaction-list.tsx      List with delete
    transaction-form.tsx      Client: add income/expense
    category-breakdown.tsx    Category spending bars

lib/
  actions/                    Server Actions — all DB mutations
    groups.ts                 createGroup, getGroupByToken, addGroupMember
    expenses.ts               addExpense, getGroupExpenses
    settlements.ts            getGroupBalances, getSettlementSuggestions, markSettlementPaid
    personal.ts               addPersonalTransaction, getPersonalTransactions, deletePersonalTransaction
  calculations/               Pure functions, no I/O
    split.ts                  calculateSplits() — equal, exact, percentage, shares
    balances.ts               calculateMemberBalances(), calculateSettlements()
    personal.ts               calculatePersonalSummary()
    export.ts                 generateCSV() — client-side Blob download
  db/
    schema.ts                 Drizzle table definitions
    relations.ts              Drizzle relational config
    index.ts                  getDb() — dual-mode client (better-sqlite3 / CF D1)
  formatting.ts               formatCurrency, formatDate, generateInteracMessage
  constants.ts                Currencies, categories, split methods
  utils.ts                    cn() for Tailwind class merging
  validations/
    group.ts                  createGroupSchema, addMemberSchema
    expense.ts                addExpenseSchema
    personal.ts               addTransactionSchema

types/
  index.ts                    All shared TypeScript types + ActionResult<T>
  cloudflare.d.ts             Minimal D1Database interface

scripts/
  migrate.js                  Applies migration SQL (used by Docker entrypoint)

migrations/
  0001_initial.sql            SQLite-compatible schema creation

lib/db/migrations/            Drizzle-generated migration files (dev reference)

public/
  manifest.json               PWA manifest
  sw.js                       Service worker (cache-first static, network-first actions)
  icons/                      PWA icons (192px, 512px)
```

---

## Code Conventions

- **No inline comments** unless the reason is non-obvious
- **Server Actions** are the only place that touches the database
- **Pure calculations** live in `lib/calculations/` — no imports from Next.js or DB
- **All amounts** are integer cents throughout — never float dollars
- **`getDb()`** — never import `db` directly; always call `getDb()` inside the function body
- TypeScript strict mode is enforced — no `any` except the documented DB singleton

---

## Testing

FairTab has no automated test suite in the current MVP. To verify a change:

1. Run `npm run typecheck` — zero errors required
2. Run `npm run build` — production build must succeed
3. Manually test the affected user flow

See [docs/contributing.md](contributing.md) for how to add tests.
