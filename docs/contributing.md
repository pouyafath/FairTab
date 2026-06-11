# Contributing to FairTab

Thank you for considering a contribution! FairTab is a small, focused project — contributions that align with its goals (free, private, simple) are most welcome.

---

## Before You Start

- **Open an issue first** for any significant feature or architectural change. This saves time if the direction doesn't fit the project.
- Bug fixes and small improvements can go straight to a PR.
- Use Node.js 20+ and npm 10+. If you use a Node version manager, run `nvm use` from the repo root.
- The code style is enforced by TypeScript strict mode and ESLint. Run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build` before pushing.

---

## Development Setup

See [docs/development.md](development.md) for the full setup guide.

```bash
git clone https://github.com/pouyafath/FairTab.git
cd FairTab
nvm use   # optional, if you use nvm
npm install
cp .env.example .env.local
npm run db:push
npm run dev
```

---

## Workflow

1. **Fork** the repository
2. **Create a branch** from `main`:
   ```bash
   git checkout -b fix/settlement-rounding
   git checkout -b feat/recurring-expenses
   ```
3. **Make your changes** — keep them focused on one thing
4. **Verify** everything still works:
   ```bash
   npm run typecheck   # must pass (zero errors)
   npm run lint        # fix any warnings
   npm run test        # must pass
   npm run build       # must pass
   ```
5. **Commit** with a clear message (see style below)
6. **Push** and open a Pull Request against `main`

## Parallel Work Checklist

- **Frontend**: work in `components/` and pass typed action props from pages; use `tests/fixtures/` for mock group, expense, settlement, transaction, and action data.
- **Backend use cases**: work in `lib/backend/services/` and add server-independent coverage in `tests/backend/`.
- **Persistence/server**: work behind `lib/backend/ports.ts` in repository adapters and deployment docs; do not move database access into UI or services.
- **Server setup**: keep Docker, production database, and deployment execution separate until server infrastructure work starts.

---

## Commit Message Style

Format: `type: short description`

| Type | When to use |
|---|---|
| `feat` | New user-facing feature |
| `fix` | Bug fix |
| `refactor` | Code change with no user-visible effect |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `chore` | Dependency updates, CI, build config |

Examples:
```
feat: add recurring expense support
fix: settlement rounding off by 1 cent when splitting 3 ways
docs: clarify Docker deployment requirements
chore: upgrade drizzle-orm to 0.46
```

Keep the subject line under 72 characters. Add a body if the "why" is non-obvious.

---

## Code Style

- **No inline comments** unless the reason is genuinely non-obvious
- **No docstrings** on simple functions — good names are enough
- **Strict types** — avoid `any`; the one documented exception is the DB singleton in `lib/db/index.ts`
- **Client components** receive action functions as props instead of importing Server Actions directly
- **Server Actions** are thin Next.js adapters — keep business logic in `lib/backend/services/`
- **Repository adapters** are the only layer that calls `getDb()`
- **Pure business math** belongs in `lib/calculations/`
- **Integer cents everywhere** — never convert to dollars inside server code
- **No premature abstractions** — three similar lines is fine; a helper is only justified at four or more

---

## Pull Request Guidelines

- Keep PRs small and focused — one feature or fix per PR
- Update documentation if you change user-facing behavior
- If you add a new database column, update:
  - `lib/db/schema.ts`
  - `types/index.ts`
  - `migrations/0001_initial.sql` (add the column with a default)
  - `docs/database.md`
- Link the related issue in the PR description

---

## Adding Tests

- Backend service tests go in `tests/backend/`
- In-memory repository support goes in `tests/support/`
- Tests should not require Docker, SQLite, D1, migrations, or a running Next.js server
- Pure calculation functions (`lib/calculations/`) are ideal candidates for additional focused tests

---

## Reporting Bugs

Open a GitHub issue with:
1. Steps to reproduce
2. Expected behaviour
3. Actual behaviour
4. Browser / OS / Node.js version

---

## Feature Requests

Open a GitHub issue with:
1. The problem you're trying to solve (not just the solution)
2. How you currently work around it

---

## What Won't Be Accepted

- Bank integrations or payment processing
- Features that require user accounts / email verification (in MVP scope)
- Breaking changes to the database schema without a migration path
- Changes that add tracking, analytics, or telemetry
