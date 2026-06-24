# Docker Deployment

FairTab ships with a multi-stage `Dockerfile` and a `docker-compose.yml` for easy self-hosting.

---

## Before You Deploy

FairTab has no user accounts. Anyone who can reach the instance can open the shared personal
dashboard, and anyone with a group token can manage that group. For trusted-LAN use that is the
point; for anything else, enable the built-in access gate and/or restrict network access.

### Access gate (optional)

Set `APP_ACCESS_PIN` (in `.env` next to `docker-compose.yml`, or directly in the compose file)
to require a PIN once per browser:

```bash
echo 'APP_ACCESS_PIN=a-long-passphrase-not-1234' >> .env
docker compose up -d
```

- Every page and API route redirects to `/unlock` (or returns 401) until the PIN is entered;
  the resulting cookie lasts 30 days.
- `/api/health` stays open so Docker healthchecks and uptime monitors keep working.
- Changing the PIN invalidates all existing sessions. Unsetting it disables the gate.
- Enable this **before** exposing the instance to the internet, and serve it over HTTPS.

See [project-overview.md](project-overview.md#data-and-trust-model) for details.

---

## Quick Start

```bash
git clone https://github.com/pouyafath/FairTab.git
cd FairTab
mkdir -p data
docker compose up -d
```

The app starts at **http://localhost:3000**.  
The SQLite database file is at `./data/fairtab.db`.

---

## How It Works

### Multi-stage Dockerfile

```
Stage 1 (builder):  node:20-alpine
  ├─ apk: python3 make g++  (compile better-sqlite3 native binding)
  ├─ npm ci                 (all deps including devDeps for the build)
  └─ npm run build          (Next.js standalone output → .next/standalone/)

Stage 2 (runner):   node:20-alpine
  ├─ .next/standalone/      (minimal server + node_modules)
  ├─ .next/static/          (hashed CSS/JS assets)
  ├─ public/                (PWA icons, manifest, service worker)
  ├─ migrations/            (SQL applied by the migration runner)
  └─ scripts/migrate.js     (idempotent runner via better-sqlite3)
```

The final image is ~200 MB. `better-sqlite3` (a native module) is built inside the Alpine container so it works without any extra libraries in the runner stage.

### Database Migrations

`docker-entrypoint.sh` runs `node /app/scripts/migrate.js` on **every** container
start, before `node server.js`. The runner is idempotent:

- Applied files are recorded in a `_migrations` table inside the database.
- On each boot, every `migrations/*.sql` file is applied in lexical order,
  skipping any already recorded — so upgrading the image automatically applies
  new migrations exactly once.
- Databases created before the `_migrations` table existed are detected and
  baselined: the initial schema is recorded as applied without being re-run.

No manual steps are needed when upgrading — pull the new image and restart.

### Database Location

```
./data/fairtab.db    ← bind-mounted into /data/fairtab.db inside the container
./data/uploads/      ← uploaded receipt files (created on first boot)
```

These are plain files on your host. Back them up by copying the `./data`
directory, or use Settings → Data → **Download backup** for a portable JSON
export of the database (receipt files stay in `./data/uploads`).

---

## docker-compose.yml Explained

```yaml
services:
  fairtab:
    build: .
    restart: unless-stopped      # auto-start on reboot, restart on crash
    ports:
      - "3000:3000"              # host:container — change left side for a different port
    volumes:
      - ./data:/data             # persists the SQLite file outside the container
    environment:
      NODE_ENV: production
      DATABASE_URL: /data/fairtab.db
      NEXT_PUBLIC_APP_URL: ${NEXT_PUBLIC_APP_URL:-http://localhost:3000}
```

To run on a different port (e.g. 8080):
```yaml
ports:
  - "8080:3000"
```

---

## Environment Variables

Set these in `docker-compose.yml` or in a `.env.local` file:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `/data/fairtab.db` | SQLite file path inside the container |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Public URL (shows in PWA manifest) |
| `NODE_ENV` | `production` | Must be `production` in Docker |

---

## Common Commands

```bash
# Start (background)
docker compose up -d

# View live logs
docker compose logs -f

# Stop
docker compose down

# Rebuild after a git pull
docker compose down
docker compose up -d --build

# Open a shell inside the container
docker compose exec fairtab sh

# Check health
docker compose ps
curl http://localhost:3000/api/health

# View database size
ls -lh ./data/fairtab.db
```

---

## Updating FairTab

```bash
cd ~/FairTab
git pull

# Rebuild image with new code
docker compose down
docker compose up -d --build

# Watch logs to confirm healthy start
docker compose logs -f
```

Your `./data/fairtab.db` is never touched by the build — data is always safe.

---

## Backup and Restore

### JSON backup (token-gated)

Set `FAIRTAB_BACKUP_TOKEN`, then export from Settings → **Backup and
restore** → **Export**, or:

```bash
curl -fsS -H "Authorization: Bearer $FAIRTAB_BACKUP_TOKEN" \
  http://localhost:3000/api/backups/export -o fairtab-backup-$(date +%Y%m%d).json
```

Export and restore both refuse to run until `FAIRTAB_BACKUP_TOKEN` is
configured. Restore from Settings → **Backup and restore** (replaces all
data, type-to-confirm `REPLACE ALL FAIRTAB DATA`). Receipt files are not in
the JSON — they live in `./data/uploads`, so back up the whole `./data`
directory too. See [docs/database.md](./database.md#backup) for the full
backup model.

### File-level backup

```bash
# Manual — covers database AND receipts
cp -r ./data ./data-backup-$(date +%Y%m%d)

# Automated daily backup (crontab -e)
0 2 * * * cp -r ~/FairTab/data ~/FairTab/data-backup-$(date +\%Y\%m\%d)
```

### File-level restore

```bash
docker compose down
rm -rf ./data && cp -r ./data-backup-20260101 ./data
docker compose up -d
```

---

## Home-Server Operation

Host-level VPN, firewall, reverse proxy, TLS, monitoring, and backup configuration belongs in
[pouyafath/Phomeserver](https://github.com/pouyafath/Phomeserver). This repository documents the
FairTab container and application behavior only.

---

## Health Check

The container exposes a health endpoint:

```
GET /api/health → { "status": "ok", "timestamp": "..." }
```

Docker polls it every 30 seconds. You can also use it with uptime monitors (UptimeRobot, Healthchecks.io).
