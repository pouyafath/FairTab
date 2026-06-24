# QA and Browser Testing

FairTab has backend tests that run without a browser or database, plus Playwright specs for
browser-level product flows.

## Required Environment

- Node.js 20+
- npm 10+
- A local dependency install from the lockfile
- Chromium installed for Playwright browser checks

```bash
npm install
npx playwright install chromium
npm run doctor
```

`@playwright/test` is declared as a dev dependency, so CI and local runs use the same package
version from `package-lock.json`.

## Run Checks

```bash
npm run doctor
npm run lint
npm run typecheck
npm test
npm run db:verify-migrations
```

For a full local release verification, including non-visual Chromium E2E:

```bash
npm run release:report
npm run verify
```

`npm run release:report` is non-mutating and prints a Markdown review summary grouped by backend,
database, UI, QA/CI, backup/safety, docs, and other changed paths. It also includes a reviewer
checklist generated from the buckets that actually contain changes.

`npm run doctor` is non-mutating. It checks the local Node/npm toolchain, installed release command
dependencies, the Node migration verifier, migration file presence, Playwright package/browser
readiness, and production smoke environment hints before the heavier release gates run. If
dependencies are already installed, missing or outdated npm is reported as a warning because the
release gate uses direct Node commands.

`npm run release:check` runs `git diff --check`, `doctor`, lint, typecheck, backend tests, migration
verification, Chromium E2E, production build, and optionally deploy smoke when `SMOKE_BASE_URL` is
set.

## Run Browser E2E

The Playwright config starts `next dev` automatically unless `PLAYWRIGHT_BASE_URL` is set. For the
automatic server path, it resets `DATABASE_URL` (default `./.tmp/fairtab-e2e.db`), applies
migrations, and seeds deterministic E2E records before starting the app.

```bash
npm run test:e2e
```

To test an already-running deployment:

```bash
PLAYWRIGHT_BASE_URL=http://localhost:3000 npm run test:e2e
```

When `PLAYWRIGHT_BASE_URL` is set, Playwright does not manage the server or database. Make sure the
target has a migrated database before running the suite.

To prepare the isolated E2E database without running browser tests:

```bash
npm run test:e2e:prepare
```

The GitHub `Browser E2E` workflow runs the non-visual browser tests with the same dependency
version declared in the lockfile, then installs the Chromium browser binary for the job.

Current browser coverage focuses on:

- Seeded group, expense, personal transaction, recent group, and health metadata checks
- Full JSON backup export, restore dry-run validation, and restore authorization checks
- Homepage primary workflow navigation
- Group creation, member creation, expense creation, archive/unarchive
- Personal transaction creation, filtering, and CSV export
- Keyboard-accessible primary navigation and form controls
- Desktop, tablet, and mobile layout smoke checks
- Not-found recovery UI and route-level production fallback presence

## Visual Regression

Visual screenshot specs are tagged `@visual` and are opt-in. Baseline PNGs are intentionally not
committed yet because the UI is still moving; generate them locally only for manual review and do
not add the generated PNGs to the branch.

Generate or update baselines locally:

```bash
npm run test:e2e:visual -- --update-snapshots
```

Run visual checks after local baselines exist:

```bash
npm run test:e2e:visual
```

The initial visual set covers:

- `/`
- `/groups`
- `/personal`
- `/settings`

## Manual Visual QA

Before shipping broad UI changes, check these screens at desktop and mobile widths:

- `/`
- `/groups`
- `/groups/new`
- A populated `/groups/[token]`
- `/groups/[token]/expenses/new`
- `/groups/[token]/settlements`
- `/personal`
- `/personal/transactions/new`
- `/settings`
- `/privacy`

Confirm that action bars remain reachable, dialogs fit on mobile, focus rings are visible, and
empty/archive states are clear.

## Backup Restore QA

Backend coverage exercises JSON restore into an empty target, blocks empty restore against a
non-empty target, blocks replace restore without the exact confirmation phrase, and confirms that
replace restore removes existing data before importing the backup.

Browser coverage intentionally does not run a destructive restore. It verifies the restore endpoint
is protected by backup authorization, while Settings provides the manual restore controls for a
separate restore drill. Dry-run validation should show incoming row counts, current row counts,
conflicts grouped by table, and non-blocking warnings for suspicious future timestamps.

## Production Smoke QA

The deploy smoke script always checks routes, health, storage metadata, and migration drift. For
production environments that must have backup protection enabled, add `SMOKE_REQUIRE_BACKUP_AUTH=1`
so smoke also fails when `/api/health` reports missing backup authorization.
