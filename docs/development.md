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

If you use a Node version manager, run `nvm use` from the repo root. `.nvmrc` pins the project to
Node 20. Use a normal system Node.js/npm install for builds and browser QA; embedded Node runtimes
without `npm` on `PATH` can run some direct binaries, but they cannot install dependencies,
Playwright browsers, or reliably resolve native Next.js packages.

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

Install Playwright's browser binary before running browser E2E locally:

```bash
npx playwright install chromium
```

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server with Turbopack (hot reload) |
| `npm run build` | Production build (creates `.next/` and `.next/standalone/`) |
| `npm run start` | Run the production build locally |
| `npm run test` | Run backend service tests with in-memory repositories, no server or DB |
| `npm run verify` | Run lint, typecheck, tests, migration smoke, and Chromium E2E |
| `npm run test:e2e:prepare` | Reset, migrate, and seed the isolated E2E database |
| `npm run test:e2e` | Run non-visual Playwright browser E2E specs against `./.tmp/fairtab-e2e.db` |
| `npm run test:e2e:visual` | Run opt-in Playwright visual snapshot specs against `./.tmp/fairtab-e2e.db` |
| `npm run deploy:smoke` | Check `/`, `/groups`, `/personal`, and `/api/health` on a running app |
| `npm run release:check` | Run direct release verification: whitespace, doctor, lint, typecheck, backend tests, migration verifier, Chromium E2E, build, and optional smoke |
| `npm run release:report` | Print changed paths grouped by release review area |
| `npm run typecheck` | TypeScript type check (no emit) |
| `npm run lint` | Run ESLint |
| `npm run db:verify-migrations` | Verify migrations with a temporary `better-sqlite3` database |
| `npm run db:push` | Sync Drizzle schema → SQLite (creates `fairtab.db` if missing) |
| `npm run db:studio` | Open Drizzle Studio at [http://localhost:4983](http://localhost:4983) |
| `npm run db:generate` | Generate SQL migration files from schema changes |
| `npm run db:migrate` | Apply pending `migrations/*.sql` files idempotently |
| `npm run pages:build` | Build for Cloudflare Workers (`@opennextjs/cloudflare`) |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `./fairtab.db` | Path to the SQLite database file |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Public URL (used in PWA manifest) |
| `FAIRTAB_BACKUP_TOKEN` | unset | Bearer token required to export or restore a full JSON backup; the dry-run validate route stays open regardless |
| `SMOKE_REQUIRE_BACKUP_AUTH` | unset | Set to `1` when deploy smoke should fail if `/api/health` reports missing backup authorization |

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
    page.tsx                  Recent groups and token lookup
    new/page.tsx              Create group form
    [token]/
      page.tsx                Group dashboard (force-dynamic)
      expenses/new/page.tsx   Add expense form
      expenses/[expenseId]/edit/page.tsx
                                Edit expense form
      settlements/page.tsx    Settle up view
  personal/
    page.tsx                  Personal finance dashboard
    transactions/new/page.tsx Add income/expense
    transactions/[id]/edit/   Edit an existing transaction
  api/health/route.ts         Health check endpoint
  privacy/page.tsx            Privacy policy (static)
  settings/page.tsx           Device-local default currency settings

components/
  ui/                         shadcn/ui base components
  layout/
    site-header.tsx           Sticky nav bar
    site-footer.tsx
  groups/
    recent-groups.tsx         Client: reads localStorage
    group-token-search.tsx    Client: opens a group from its token
    group-dashboard.tsx       Client: tabs for balances/expenses/settle
    balance-summary.tsx       Client: member net balances
    add-member-dialog.tsx     Client: dialog with injected add-member action
    group-settings-dialog.tsx Client: rename/delete group dialog
    member-list.tsx           Client: edit/remove group members
    new-group-form.tsx        Client: create-group form with injected action
    settlements-view.tsx      Client: copy Interac, mark paid
    settlement-preview.tsx    Client: inline settlement suggestions
  expenses/
    expense-form.tsx          Client: split UI for add/edit expense actions
    expense-list.tsx          Client: collapsible expense cards with edit/delete actions
  personal/
    personal-dashboard.tsx    Client: month filter, export, tabs
    spending-trend.tsx        Client: monthly expense trend
    summary-cards.tsx         Income / expenses / net cards
    transaction-list.tsx      List with injected delete action
    transaction-form.tsx      Client: add income/expense with injected action
    category-breakdown.tsx    Category spending bars

lib/
  actions/                    Thin Next.js Server Action adapters
    groups.ts                 create, rename, delete groups; add, update, remove members
    expenses.ts               add, get, update, delete group expenses
    settlements.ts            balances, suggestions, paid history, mark paid, undo
    personal.ts               add, get, update, delete personal transactions
  backend/
    ports.ts                  Repository contracts used by services and tests
    runtime.ts                Wires Drizzle repositories, nanoid, and clock
    services/                 Backend use cases, no Next.js or DB imports
    repositories/             Drizzle-backed repository implementations
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
  actions.ts                  Action contracts passed from pages into client components
  cloudflare.d.ts             Minimal D1Database interface

tests/
  backend/                    Backend service tests
  fixtures/                   Mock UI data and action stubs
  support/                    In-memory repository implementation
  register-loader.mjs         Registers the test TypeScript/alias loader
  ts-alias-loader.mjs         Test-time resolver for TypeScript path aliases

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
- **Client components** receive action functions as props; route pages wire them to Server Actions
- **Server Actions** stay thin: call backend services and handle Next.js revalidation
- **Backend services** do not import Next.js or database modules
- **Repository adapters** are the only layer that touches the database
- **Pure calculations** live in `lib/calculations/` — no imports from Next.js or DB
- **All amounts** are integer cents throughout — never float dollars
- **`getDb()`** — never import `db` directly; always call `getDb()` inside the function body
- TypeScript strict mode is enforced — no `any` except the documented DB singleton

## Product Constraints to Preserve

- There are no user accounts; the only access controls are the optional shared-PIN gate
  (`APP_ACCESS_PIN`) and the token-gated backup routes.
- Group tokens are shared secrets; do not expose group data through a token-free route.
- Personal transactions are instance-wide, not per-user.
- Group calculations use one currency and do not convert exchange rates.
- Personal summaries do not convert mixed currencies.
- Payment settlement is recorded manually; FairTab never initiates a payment.

User-facing changes to these constraints must update
[project-overview.md](project-overview.md), [architecture.md](architecture.md), and the README.

## Parallel Development

- Frontend developers can build reusable components with `tests/fixtures/` data and typed action stubs.
- Backend developers should add or change use cases in `lib/backend/services/` and cover them with in-memory repository tests.
- Persistence/server work should stay in repository adapters and deployment docs until the server environment is ready.

---

## Testing

Run the server-independent test suite:

```bash
npm run test
```

These tests exercise backend services through in-memory repositories, so they do not need Docker, SQLite, D1, migrations, or a running Next.js server.

To verify a broader change:

1. Run `npm run release:check` — lint, typecheck, backend tests, migration verification, Chromium E2E, and build
2. Run `SMOKE_BASE_URL=http://localhost:3000 npm run release:check` against a running build or dev server when release smoke is needed
3. Manually test the affected user flow

See [docs/contributing.md](contributing.md) for how to add tests.
