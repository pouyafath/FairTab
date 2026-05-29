# Architecture

## High-Level Overview

```
Browser
  │
  ├── Static pages (SSG): landing, groups list, privacy, settings
  │     Served from CDN / Next.js cache
  │
  └── Dynamic pages (SSR): group dashboard, add expense, settlements, personal finance
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

Groups are identified by a random 8-character token (nanoid). The token is part of the URL (`/groups/[token]`). Anyone with the link can view and add expenses. This design deliberately avoids account management complexity for small groups who trust each other.

Recently visited groups are stored in `localStorage` — no server-side session needed.

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

### Personal Finance

```
TransactionForm → addPersonalTransaction() → personal_transactions table

PersonalPage (Server Component)
  │ getPersonalTransactions() → all rows
  │ calculatePersonalSummary(transactions, year, month)
  │   → { income, expenses, net, byCategory }
  ↓
PersonalDashboard (Client Component)
  │ month selector (client-side filter of props)
  │ CSV export (client-side Blob download)
```

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
| `getDb()` called inside repository/runtime setup, not UI or services | CF Workers request context is per-request, not per-module |
| `nanoid` only in server files | ESM-only package — safe in Server Actions, breaks Client Components |
| `better-sqlite3` in `serverExternalPackages` | Native module — must not be bundled by Turbopack |
| `export const dynamic = 'force-dynamic'` on data pages | Prevents stale cached HTML on CF Pages |
