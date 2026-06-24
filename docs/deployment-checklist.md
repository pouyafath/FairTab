# Deployment Checklist

Use this before promoting a FairTab build.

## Required Environment

| Variable | Required | Notes |
|---|---:|---|
| `DATABASE_URL` | Local/Docker only | SQLite file path, for example `/data/fairtab.db` |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public origin used by PWA metadata |
| `NEXT_PUBLIC_APP_VERSION` | Optional | Overrides `package.json` version in `/api/health` |
| `NEXT_PUBLIC_BUILD_TIME` | Optional | ISO timestamp surfaced in `/api/health` |
| `FAIRTAB_BACKUP_TOKEN` | Required for restore | Protects full JSON backup export and dry-run routes; restore execution is disabled unless it is set |
| Cloudflare `DB` binding | Cloudflare only | D1 binding name must match the deployment config |

## Predeploy

```bash
npm install
npx playwright install chromium
npm run doctor
npm run release:report
npm run release:check
```

`npm run doctor` checks the local release toolchain without mutating the worktree. Missing or
outdated npm is only a warning when installed dependencies are present because the release gate uses
direct Node commands after install. `npm run release:report` prints the dirty worktree grouped by
review area and includes a reviewer checklist. `npm run release:check` runs whitespace diff
validation, `doctor`, lint, typecheck, backend tests, migration verification, Chromium E2E, and
build. Set `SMOKE_BASE_URL` to include the route smoke checker in the same command. Set
`SMOKE_REQUIRE_BACKUP_AUTH=1` for production deploy smoke when the environment is expected to have
`FAIRTAB_BACKUP_TOKEN`.

## Database Safety

Before upgrading a local or Docker deployment, create a database copy:

```bash
cp ./data/fairtab.db ./data/fairtab-backup-$(date +%Y%m%d-%H%M%S).db
```

After boot, confirm the migration summary appears in logs and that `/api/health` reports
`"status": "ok"`, database status `ok`, the expected app version, runtime storage adapter, and
`migrations.drift: false`.

Use Settings -> Data safety to download a full JSON backup and dry-run validate a backup file. If
`FAIRTAB_BACKUP_TOKEN` is configured, enter it in Settings before exporting or validating. Keep it
configured before any restore drill: JSON restore execution refuses to run without it.

Prefer the non-destructive restore path first. Empty restore only succeeds when the target database
has no FairTab records. Replace restore deletes existing FairTab records and requires the exact
confirmation phrase `REPLACE ALL FAIRTAB DATA`.

## Postdeploy Smoke

Run the route smoke checker against the deployed origin:

```bash
SMOKE_BASE_URL=https://your-fairtab.example.com npm run deploy:smoke

# Production strict mode: also fail if backup auth is missing.
SMOKE_BASE_URL=https://your-fairtab.example.com SMOKE_REQUIRE_BACKUP_AUTH=1 npm run deploy:smoke
```

The smoke script checks `/`, `/groups`, `/personal`, and `/api/health`; the health payload must
report database status `ok`, storage metadata, and no migration drift. Strict mode additionally
requires backup authorization to be configured.

## Monitor After Deploy

For the first few minutes after a release, watch:

- Container or platform logs for the `[fairtab] migration summary` line
- Backup audit logs for `[fairtab] backup export created`, restore dry-run, blocked restore, and
  completed restore events when exercising backup flows
- `/api/health` for `status`, `database.status`, `runtime.storageAdapter`, `app.version`, `app.commit`, and `migrations.drift`
- Browser smoke for homepage, groups, personal finance, and a known group token
- Failed Server Action responses around group creation, expense creation, and CSV export
