# Database

FairTab uses **SQLite** via [Drizzle ORM](https://orm.drizzle.team). In local dev and Docker self-hosting the database is a single file (`fairtab.db`). On Cloudflare Pages it uses [Cloudflare D1](https://developers.cloudflare.com/d1/) — a serverless SQLite service.

The same Drizzle schema works for both. No code changes needed between environments.

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

---

## Migrations

### Dev workflow

Drizzle watches `lib/db/schema.ts` and syncs directly to the SQLite file:

```bash
# Modify lib/db/schema.ts, then:
npm run db:push
```

### Production migration

`migrations/0001_initial.sql` is the canonical SQLite-compatible schema. It is applied automatically on the first Docker container start by `scripts/migrate.js`.

For Cloudflare D1:
```bash
wrangler d1 execute fairtab --remote --file=migrations/0001_initial.sql
```

### Adding a new migration

1. Edit `lib/db/schema.ts`
2. Run `npm run db:generate` — creates a new file in `lib/db/migrations/`
3. Convert it to a plain SQL file (replace `-->statement-breakpoint` with `;`)
4. Add it as `migrations/0002_*.sql`
5. Update `scripts/migrate.js` to also run the new file
6. Update `.github/workflows/deploy.yml` to execute it against D1

---

## Backup

### Local dev

```bash
cp fairtab.db fairtab-backup-$(date +%Y%m%d).db
```

### Docker self-hosted

The database is in `./data/fairtab.db` (a bind mount, outside the container):

```bash
# One-off backup
cp ./data/fairtab.db ./data/fairtab-backup-$(date +%Y%m%d).db

# Automated daily backup (add to crontab)
0 3 * * * cp ~/FairTab/data/fairtab.db ~/FairTab/data/backup-$(date +\%Y\%m\%d).db
```

### Home-server backups

Host-level backup schedules, off-site copies, and restore drills belong in the
[Phomeserver backup guide](https://github.com/pouyafath/Phomeserver/blob/main/docs/backups.md).

---

## Restore

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
