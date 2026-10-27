# Review Plan

The current improvement branch is broad. Review it in these chunks rather than as one large
behavioral change.

Generate a grouped path summary before review:

```bash
npm run release:report
```

The report is non-mutating and includes a reviewer checklist generated from the buckets that have
changed paths. Use that checklist as the review queue, then use the sections below for deeper focus
areas.

## 1. Backend Hardening

Focus files:

- `lib/backend/services/*`
- `lib/backend/ports.ts`
- `lib/backend/repositories/drizzle.ts`
- `tests/backend/services.test.ts`
- `tests/backend/actions.test.ts`

Review goals:

- Cross-group member IDs are rejected before writes.
- Archived groups are read-only for member, expense, and settlement mutations.
- Missing personal transaction deletes return a clear not-found result.

## 2. Database Integrity

Focus files:

- `lib/db/schema.ts`
- `migrations/0003_add_integrity_indexes.sql`
- `docs/database.md`
- `tests/backend/database.test.ts`

Review goals:

- Migration is idempotent and SQLite-compatible.
- Indexes match the read/write paths they support.
- Duplicate expense participants are blocked at the database layer.

## 3. UI and Mobile Polish

Focus files:

- `app/globals.css`
- `app/page.tsx`
- `components/layout/*`
- `components/groups/*`
- `components/personal/*`
- `components/ui/*`

Review goals:

- The refreshed visual system is consistent across core workflows.
- Mobile sticky form actions do not hide fields or dialog content.
- Empty, archived, and loading states are clear.

## 4. QA, E2E, and CI

Focus files:

- `.github/workflows/*`
- `playwright.config.mjs`
- `scripts/doctor.js`
- `scripts/release-check.js`
- `scripts/release-report.js`
- `tests/e2e/*`
- `docs/qa.md`
- `tests/support/*`

Review goals:

- CI covers fast checks and migration smoke.
- `npm run doctor` catches missing local release prerequisites before heavier gates.
- `npm run release:check` runs whitespace validation, doctor, lint, typecheck, backend tests,
  migration verification, Chromium E2E, build, and optional deploy smoke in that order.
- Migration verification uses the Node `better-sqlite3` verifier rather than requiring a separate
  SQLite CLI install.
- Browser QA is documented and reproducible in a normal Node 20/npm shell.
- Visual screenshot tests are opt-in until baselines are generated.

## 5. Backup, Restore, and Production Safety

Focus files:

- `lib/backups/*`
- `lib/backend/services/backups.ts`
- `app/api/backups/*`
- `components/settings/backup-actions.tsx`
- `scripts/smoke.js`

Review goals:

- Dry-run validation shows both incoming and current row counts.
- Restore remains token-gated and destructive replacement requires exact confirmation.
- Suspicious future timestamps are warnings, not restore blockers.
- `SMOKE_REQUIRE_BACKUP_AUTH=1` fails production smoke when backup auth is missing.

## 6. Release Hygiene

Review goals:

- Keep the branch reviewable by grouping changes into backend hardening, database integrity, UI
  polish, QA/CI, and backup safety.
- Use `npm run release:report` to compare the actual changed paths against these review buckets and
  follow the generated reviewer checklist.
- Do not include generated visual PNG baselines until the UI is stable.
- Use `npm run release:check` plus deploy smoke before promotion.
