# Database

FairTab uses **SQLite** via [Drizzle ORM](https://orm.drizzle.team). In local dev and Docker self-hosting the database is a single file (`fairtab.db`). On Cloudflare Pages it uses [Cloudflare D1](https://developers.cloudflare.com/d1/) — a serverless SQLite service.

The same Drizzle schema works for both. No code changes needed between environments.

---

## Ownership and Access

The current schema has no users, sessions, owners, or authorization tables.

- A group is accessed by its random token.
- Anyone with a group token can read and manage that group's data.
- Personal transactions are shared across the entire deployment.
- Browser-only settings such as recently visited groups and default currency are not stored in
  this database.

Use a private or trusted deployment for personal finance data. See
[project-overview.md](project-overview.md#data-and-trust-model) for details.

---

## Schema

All monetary amounts are stored as **integer cents** (e.g. $24.50 → `2450`).

### `groups`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `name` | TEXT NOT NULL | |
| `token` | TEXT NOT NULL UNIQUE | 8-char nanoid, used in the URL |
| `currency` | TEXT DEFAULT 'CAD' | |
| `created_at` | INTEGER | Unix milliseconds |

### `group_members`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `group_id` | INTEGER FK → groups(id) | CASCADE DELETE |
| `name` | TEXT NOT NULL | |
| `email` | TEXT | Optional — for Interac message |

### `expenses`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `group_id` | INTEGER FK → groups(id) | CASCADE DELETE |
| `title` | TEXT NOT NULL | |
| `amount` | INTEGER NOT NULL | Total in cents |
| `currency` | TEXT DEFAULT 'CAD' | |
| `paid_by_id` | INTEGER FK → group_members(id) | Who paid |
| `date` | INTEGER NOT NULL | Unix milliseconds |
| `category` | TEXT | Optional |
| `notes` | TEXT | Optional |
| `split_method` | TEXT | `equal` / `exact` / `percentage` / `shares` |
| `created_at` | INTEGER | Unix milliseconds |

### `expense_participants`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `expense_id` | INTEGER FK → expenses(id) | CASCADE DELETE |
| `member_id` | INTEGER FK → group_members(id) | CASCADE DELETE |
| `share_value` | INTEGER NOT NULL | Raw input (1 / cents / % / shares) |
| `amount_cents` | INTEGER NOT NULL | **Computed and stored** — not recalculated on read |

`amount_cents` is calculated at write time by `lib/calculations/split.ts` and stored. Balance queries just `SUM(amount_cents)` — no split math on reads.

Each expense can include a member only once. The database enforces this with a unique index on
`expense_participants(expense_id, member_id)`, while the backend service validates that every
participant belongs to the same group as the expense before writing.

### `settlements`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `group_id` | INTEGER FK → groups(id) | CASCADE DELETE |
| `from_member_id` | INTEGER FK → group_members(id) | Who pays |
| `to_member_id` | INTEGER FK → group_members(id) | Who receives |
| `amount` | INTEGER NOT NULL | Cents |
| `is_paid` | INTEGER DEFAULT 0 | Boolean (0/1) |
| `paid_at` | INTEGER | Unix milliseconds |

### `personal_transactions`

| Column | Type | Notes |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `type` | TEXT NOT NULL | `income` or `expense` |
| `title` | TEXT NOT NULL | |
| `amount` | INTEGER NOT NULL | Cents |
| `currency` | TEXT DEFAULT 'CAD' | |
| `date` | INTEGER NOT NULL | Unix milliseconds |
| `category` | TEXT | Optional |
| `note` | TEXT | Optional |
| `account_label` | TEXT | Optional (e.g. "Chequing") |
| `created_at` | INTEGER | Unix milliseconds |

## Integrity and Indexes

SQLite foreign keys are enabled explicitly for local/Docker connections and for the migration
runner. The schema uses cascading deletes for group-owned records and a unique index to prevent
duplicate participant rows for the same expense.

Additional indexes support the main read paths:

- `group_members(group_id)` for loading group rosters
- `expenses(group_id, date)` for group expense history
- `expenses(paid_by_id)` and `expense_participants(member_id)` for member removal checks
- `settlements(group_id, is_paid, paid_at)` for paid settlement history
- `personal_transactions(date)` for personal finance history

SQLite cannot enforce every cross-table same-group rule in this schema without duplicating
`group_id` onto more child rows, so the backend service layer also validates membership for
expenses and settlements.

---

## Migrations

### Dev workflow

Drizzle watches `lib/db/schema.ts` and syncs directly to the SQLite file:

```bash
# Modify lib/db/schema.ts, then:
npm run db:push
```

### Production migration

`migrations/*.sql` are the canonical SQLite-compatible schema files. On Docker,
`scripts/migrate.js` runs on every container start: it records applied files in
a `_migrations` table and applies any new ones in lexical order, so upgrades
are automatic and idempotent. Pre-existing databases without migration history
are baselined (the initial schema is recorded without being re-run).

For Cloudflare D1, `wrangler` tracks applied migrations itself:
```bash
wrangler d1 migrations apply fairtab --remote
```

### Verifying migrations

Before shipping a migration, apply all SQL files to a temporary SQLite database with the Node
verifier:

```bash
npm run db:verify-migrations
```

The verifier uses `better-sqlite3`, runs `PRAGMA foreign_key_check`, and cleans up its temporary
database files automatically.

For D1, preview locally first, then apply remote:

```bash
wrangler d1 migrations apply fairtab --local
wrangler d1 migrations apply fairtab --remote
```

### Observing migrations

`npm run db:migrate` logs each migration as `apply`, `skip`, or `baseline`, then emits a final
`[fairtab] migration summary {...}` JSON line with the database path, migration directory,
applied files, skipped files, baselined files, and duration. Keep that line in deploy logs; it is
the quickest way to confirm that a container boot applied the expected files.

`GET /api/health` probes a real application table and returns migration tracking metadata when the
local `_migrations` table exists:

```json
{
  "status": "ok",
  "database": { "status": "ok" },
  "migrations": {
    "status": "tracked",
    "appliedCount": 3,
    "latest": "0003_add_integrity_indexes.sql",
    "latestAppliedAt": "2026-06-22T21:06:28.000Z"
  }
}
```

Cloudflare D1 uses Wrangler's own migration ledger, so the health endpoint may report
`"migrations": { "status": "untracked" }` there even when the database is healthy.

### Adding a new migration

1. Edit `lib/db/schema.ts`
2. Run `npm run db:generate` — creates a new file in `lib/db/migrations/`
3. Convert it to a plain SQL file (replace `-->statement-breakpoint` with `;`)
4. Add it as `migrations/000X_*.sql` (next free number; lexical order is the apply order)

Nothing else: both the Docker entrypoint and `wrangler d1 migrations apply`
discover new files automatically.

---

## Backup

> **Note:** FairTab currently ships two independent backup/restore implementations
> pending unification (see the note on `LegacyBackupRepository` in
> `lib/backend/ports.ts`). Both are documented below until one is retired.

### Built-in JSON backup (recommended)

Settings → **Data** → **Download backup** produces a portable JSON document with
every table (groups, members, expenses, participants, settlements, personal
transactions, recurring rules, savings goals, attachment metadata). The same
document is served at `GET /api/backup`, so it can be scripted:

```bash
curl -fsS http://localhost:3000/api/backup -o fairtab-backup-$(date +%Y%m%d).json
```

**Restore** (Settings → Data → Restore, or `POST /api/backup` with the JSON body)
replaces *all* data in the instance. References are remapped to fresh ids, so a
backup can be restored into any FairTab instance — group share URLs keep working
because tokens are preserved. On SQLite the restore runs inside a transaction
(all-or-nothing); on Cloudflare D1 interactive transactions are unavailable, so
a mid-restore failure there can leave partial data — re-run the restore.

This endpoint does not currently require authentication — anyone who can reach
the app can export or replace all data. If you're exposing FairTab beyond your
LAN, prefer the token-gated endpoints below, or wait for an access gate.

### Application JSON export/restore (token-gated)

Settings → Data safety also includes a full JSON export for groups, members,
expenses, expense splits, settlements, and personal transactions (recurring
rules, savings goals, and attachments are not yet included here). This is
useful for auditability, off-site copies, and checking a backup before a
database-file restore.

For production deployments, set `FAIRTAB_BACKUP_TOKEN` so `/api/backups/export` and
`/api/backups/validate` require a bearer token. Without that variable, those read-only
endpoints are open to anyone who can reach the app.

Dry-run validation accepts a FairTab backup JSON file and checks shape, duplicate IDs,
foreign-key references, split totals, suspicious future timestamps, and conflicts with the current
database. It previews incoming row counts against current row counts and does not write data.

Settings → Data safety can restore a validated FairTab JSON backup through
`/api/backups/restore`. Restore execution is intentionally stricter than export or dry-run:

- `FAIRTAB_BACKUP_TOKEN` must be configured on the server.
- The request must include `Authorization: Bearer <FAIRTAB_BACKUP_TOKEN>`.
- Empty restore only writes when the current database has no FairTab records.
- Replace restore deletes existing FairTab records first and requires the exact confirmation phrase
  `REPLACE ALL FAIRTAB DATA`.

Every export, dry-run validation, blocked restore, and completed restore writes a structured
`[fairtab]` log line with row counts and restore mode. Keep those logs with deployment logs when
performing a restore drill.

Receipt **files** are not inside the JSON (it stays small and DB-agnostic);
they live in the uploads directory next to the database. Copying the whole
`./data` directory therefore covers both.

### File-level backup

```bash
# Local dev
cp fairtab.db fairtab-backup-$(date +%Y%m%d).db

# Docker self-hosted — ./data holds the SQLite file AND uploaded receipts
cp -r ./data ./data-backup-$(date +%Y%m%d)

# Automated daily backup (add to crontab)
0 3 * * * cp -r ~/FairTab/data ~/FairTab/data-backup-$(date +\%Y\%m\%d)
```

### Home-server backups

Host-level backup schedules, off-site copies, and restore drills belong in the
[Phomeserver backup guide](https://github.com/pouyafath/Phomeserver/blob/main/docs/backups.md).

---

## Database file restore

```bash
# Stop the container
docker compose down

# Replace the database file
cp ./data/backup-20260101.db ./data/fairtab.db

# Start again
docker compose up -d
```

---

## Browsing Data

### Drizzle Studio (dev)

```bash
npm run db:studio
# Open http://localhost:4983
```

### SQLite CLI

```bash
# Install sqlite3
sudo apt install -y sqlite3   # Ubuntu

# Browse
sqlite3 fairtab.db
.tables
SELECT * FROM groups;
.quit
```

---

## WAL Mode

FairTab enables SQLite WAL (Write-Ahead Logging) mode:

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
```

WAL allows concurrent reads while a write is in progress — important for a web app. Foreign key enforcement is also enabled explicitly since SQLite disables it by default.
