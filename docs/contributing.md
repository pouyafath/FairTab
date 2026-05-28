# Contributing to FairTab

Thank you for considering a contribution! FairTab is a small, focused project — contributions that align with its goals (free, private, simple) are most welcome.

---

## Before You Start

- **Open an issue first** for any significant feature or architectural change. This saves time if the direction doesn't fit the project.
- Bug fixes and small improvements can go straight to a PR.
- The code style is enforced by TypeScript strict mode and ESLint. Run `npm run typecheck && npm run lint` before pushing.

---

## Development Setup

See [docs/development.md](development.md) for the full setup guide.

```bash
git clone https://github.com/pouyafath/FairTab.git
cd FairTab
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
   npm run build       # must pass
   npm run lint        # fix any warnings
   ```
5. **Commit** with a clear message (see style below)
6. **Push** and open a Pull Request against `main`

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
docs: add self-hosting guide for Raspberry Pi
chore: upgrade drizzle-orm to 0.46
```

Keep the subject line under 72 characters. Add a body if the "why" is non-obvious.

---

## Code Style

- **No inline comments** unless the reason is genuinely non-obvious
- **No docstrings** on simple functions — good names are enough
- **Strict types** — avoid `any`; the one documented exception is the DB singleton in `lib/db/index.ts`
- **Server Actions** are the only layer that calls `getDb()` — keep business logic in `lib/calculations/`
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

The MVP has no automated tests. If you'd like to add some:

- Pure calculation functions (`lib/calculations/`) are ideal candidates for unit tests
- Suggested test framework: **Vitest** (compatible with the existing TypeScript setup)
- Add test files alongside the source as `*.test.ts`

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
