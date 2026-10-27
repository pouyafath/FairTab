# Architecture

## High-Level Overview

```
Browser
  │
  ├── Static pages (SSG): landing, groups list, privacy, settings
  │     Served from CDN / Next.js cache
  │
  └── Dynamic pages (SSR): group dashboard, expenses, settlements, personal finance
        ↓ Server Component renders on request
        ↓ passes Server Actions into client components as action contracts
        ↓ lib/actions/ thin Next.js adapters
        ↓ lib/backend/services/ use cases
        ↓ lib/backend/ports.ts repository interfaces
        ↓ lib/backend/repositories/drizzle.ts
        ↓ getDb() → better-sqlite3 (local/Docker) OR D1 (Cloudflare Pages)
        ↓ SQLite database
```

There is no separate API server in the current app. The important boundary is still explicit:

- `components/` contain reusable UI and receive action functions as props.
- `lib/actions/` contain only Next.js concerns such as cache revalidation.
- `lib/backend/services/` contain validation and use-case orchestration.
- `lib/backend/repositories/` contain database access.

This keeps frontend work, backend use-case work, and database adapter work separate enough for a small team to work in parallel.

---

## Runtime Modes

| Mode | Runtime | Database | How detected |
|---|---|---|---|
| `npm run dev` | Node.js | `better-sqlite3` (local file) | No CF context global |
| `docker compose up` | Node.js | `better-sqlite3` (bind-mounted file) | No CF context global |
| Cloudflare Pages | CF Workers | Cloudflare D1 | `globalThis[Symbol.for('__cloudflare-request-context__')]` is set |

`lib/db/index.ts` → `getDb()` handles the switch at request time with zero configuration.

---

## Tech Stack Decisions

### Next.js 16 App Router

- Server Components render data-fetching pages on the server — no client-side fetch waterfalls
- Server Actions handle mutations — no API routes needed
- Turbopack for fast local builds

### SQLite + Drizzle ORM

- SQLite stores everything in a single file — trivial backup, zero administration
- Drizzle generates type-safe queries from the TypeScript schema
- `drizzle-orm/sqlite-core` schema is compatible with both `better-sqlite3` and Cloudflare D1
- All amounts stored as **integer cents** — no floating-point rounding errors

### No Authentication (MVP)

Groups are identified by a random 8-character token (nanoid). The token is part of the URL (`/groups/[token]`). Anyone with the link can view and manage the group. This design deliberately avoids account management complexity for small groups who trust each other.

Recently visited groups are stored in `localStorage` — no server-side session needed.

The personal dashboard is also unauthenticated. Personal transactions are stored in the shared
deployment database and are visible to anyone who can access `/personal`. They are not scoped to
a browser, group, or user. This makes the current personal finance feature appropriate for local,
private, or otherwise trusted deployments, not public multi-user hosting.

See [project-overview.md](project-overview.md#data-and-trust-model) for the full trust model.

### shadcn/ui + Tailwind CSS v3

shadcn components are copied into the codebase (not a library dependency), making them fully customisable without upgrade conflicts. Tailwind v3 is pinned for shadcn compatibility.

---

## Data Flow

### Adding an Expense

```
ExpenseForm (Client Component)
  │ user submits form
  ↓ addExpenseAction prop
lib/actions/expenses.ts
  │ Next.js Server Action adapter
  ↓
backend.expenses.addExpense()
  │ Zod validates input
  │ calculateSplits() → per-participant amountCents
  ↓
ExpenseRepository
  ↓
DB: INSERT INTO expenses
DB: INSERT INTO expense_participants (one row per participant with amountCents stored)
  │
router.push() → group dashboard reloads
```

The key design choice: **`amountCents` is stored** in `expense_participants` at write time, not recalculated on every read. Balance queries just `SUM(amountCents)` — no split math at query time.

### Editing or Deleting an Expense

```
ExpenseList / ExpenseForm (Client Component)
  │ user edits or deletes an existing expense
  ↓ updateExpenseAction / deleteExpenseAction prop
lib/actions/expenses.ts
  │ revalidates group pages on success
  ↓
backend.expenses.updateExpense() / deleteExpense()
  │ validates input and recalculates stored participant shares for edits
  ↓
ExpenseRepository
  ↓
DB: UPDATE expense + replace participant rows OR DELETE expense
```

Edits use the same validation and split calculation path as new expenses. Deleting an expense removes its participant rows through the repository/database cascade.

### Managing a Group

```
GroupSettingsDialog / MemberList (Client Components)
  │ user renames/deletes group or edits/removes members
  ↓ group action prop
lib/actions/groups.ts
  │ revalidates group pages on success
  ↓
backend.groups.*
  │ validates names/emails and checks member expense references before removal
  ↓
GroupRepository
```

Deleting a group cascades through members, expenses, and participant rows. Removing a member is blocked when that member is referenced by existing expenses; users must edit or delete those expenses first.

### Calculating Settlements

```
getGroupBalances(groupId)
  │ fetch all members
  │ fetch all expenses with participants
  │ calculateMemberBalances():
  │   for each expense:
  │     payer's balance += totalAmount
  │     each participant's balance -= amountCents
  ↓
calculateSettlements(balances)
  │ greedy algorithm:
  │   sort creditors (positive balance) desc
  │   sort debtors (negative balance) asc
  │   match largest creditor with largest debtor
  │   create settlement for min(credit, debt)
  │   repeat until all balanced
  ↓
SettlementsView renders the transfer list
```

Recorded settlements are payment-history records. They do not initiate a payment. The current
settlement service uses paid records to hide matching suggestions and supports deleting a paid
record to undo it.

### Personal Finance

```
TransactionForm → add/update personal transaction → personal_transactions table

PersonalPage (Server Component)
  │ getPersonalTransactions() → all rows
  │ calculatePersonalSummary(transactions, year, month)
  │   → { income, expenses, net, byCategory }
  ↓
PersonalDashboard (Client Component)
  │ month selector (client-side filter of props)
  │ spending trend and category breakdown
  │ CSV export (client-side Blob download)
```

Personal transactions are instance-wide in the current no-auth design. Summary calculations do
not convert currencies, so users should keep personal transactions in one currency when they
want meaningful totals.

---

## Split Calculation Algorithm

All calculations live in `lib/calculations/split.ts`. Pure functions — no I/O.

### Equal split

```
floor(totalCents / n) per person
remainder = totalCents - (floor * n)
first `remainder` participants each get 1 extra cent
```

This guarantees `sum(amountCents) === totalCents` exactly — never off by a cent.

**Example**: $100.00 split 3 ways → $33.34 + $33.33 + $33.33

### Exact

Participants enter dollar amounts directly. Their sum must equal the expense total, or the action returns an error.

### Percentage

```
floor(totalCents * pct / 100) per person
remainder distributed to participants with highest fractional parts
```

Percentages must sum to 100.

### Shares

```
floor(totalCents * shares / totalShares) per person
remainder distributed to highest fractional parts
```

---

## File Naming and Organisation

- **Server Actions** → `lib/actions/*.ts` — `'use server'` at top, thin adapters over backend services
- **Backend services** → `lib/backend/services/*.ts` — validation and use cases, no Next.js or DB imports
- **Repository ports** → `lib/backend/ports.ts` — contracts used by backend services and tests
- **Repository adapters** → `lib/backend/repositories/*.ts` — database-specific implementations
- **Pure calculations** → `lib/calculations/*.ts` — no imports from Next.js, DB, or actions
- **Client Components** → files with `'use client'` at top — no direct DB or server imports
- **Types** → `types/index.ts` — one source of truth for all shared types

## Testing Boundary

Backend service tests run with in-memory repositories from `tests/support/`. They do not start Next.js, connect to SQLite/D1, run migrations, or require the future production server. This is the main safety net while server infrastructure is being prepared separately.

---

## Key Constraints

| Constraint | Reason |
|---|---|
| All amounts are integer cents | No floating-point rounding errors in financial math |
| One currency per group | Group balances and settlements do not perform exchange-rate conversion |
| Personal totals do not convert currencies | Mixed-currency personal summaries are not financially meaningful |
| `getDb()` called inside repository/runtime setup, not UI or services | CF Workers request context is per-request, not per-module |
| `getBackend()` memoized for Node.js only — fresh instance on CF Pages | D1 binding is tied to the CF request context; caching it across requests would use a stale binding |
| `RawExpenseData` defined in `types/index.ts`, re-exported from `lib/calculations/balances.ts` | Keeps `lib/backend/ports.ts` depending only on `@/types`, not on the calculations layer |
| `toEpochMs(null)` returns `0` | Drizzle infers nullable types for columns without `.notNull()`; returning 0 prevents crashes on rows with missing timestamps |
| `nanoid` only in server files | ESM-only package — safe in Server Actions, breaks Client Components |
| `better-sqlite3` in `serverExternalPackages` | Native module — must not be bundled by Turbopack |
| `export const dynamic = 'force-dynamic'` on data pages | Prevents stale cached HTML on CF Pages |
