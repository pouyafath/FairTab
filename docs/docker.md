# Docker Deployment

FairTab ships with a multi-stage `Dockerfile` and a `docker-compose.yml` for easy self-hosting.

---

## Before You Deploy

FairTab currently has no authentication or authorization. Anyone who can reach the instance can
open the shared personal dashboard, and anyone with a group token can manage that group. Restrict
network access or place FairTab behind an access-control layer when the deployment is not limited
to trusted users.

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
  ├─ migrations/            (SQL used on first start)
  └─ scripts/migrate.js     (runs the SQL via better-sqlite3)
```

The final image is ~200 MB. `better-sqlite3` (a native module) is built inside the Alpine container so it works without any extra libraries in the runner stage.

### First-Start Database Init

`docker-entrypoint.sh` runs before `node server.js`:

```sh
if [ ! -f "$DATABASE_URL" ]; then
  node /app/scripts/migrate.js   # creates tables from migrations/0001_initial.sql
fi
exec node server.js
```

On subsequent starts the database file exists, so the check is skipped instantly.

### Database Location

```
./data/fairtab.db    ← bind-mounted into /data/fairtab.db inside the container
```

This is a plain file on your host. Back it up by copying it.

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

### Manual backup

```bash
cp ./data/fairtab.db ./data/fairtab-backup-$(date +%Y%m%d).db
```

### Automated daily backup

```bash
# Add to crontab (crontab -e)
0 2 * * * cp ~/FairTab/data/fairtab.db ~/FairTab/data/backup-$(date +\%Y\%m\%d).db
```

### Restore

```bash
docker compose down
cp ./data/backup-20260101.db ./data/fairtab.db
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
