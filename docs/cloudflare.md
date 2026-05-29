# Cloudflare Pages + D1 Deployment

Deploy FairTab to Cloudflare Pages for free, zero-maintenance cloud hosting. Uses Cloudflare D1 (serverless SQLite) as the database.

---

## Overview

| | |
|---|---|
| **Platform** | Cloudflare Pages (free tier) |
| **Database** | Cloudflare D1 (serverless SQLite, free tier: 100k reads/day, 100k writes/day) |
| **Runtime** | Cloudflare Workers (Edge, Node.js compat) |
| **CI/CD** | GitHub Actions (automated deploy on push to `main`) |

---

## Prerequisites

- A Cloudflare account ([cloudflare.com](https://cloudflare.com)) — free
- Cloudflare API token with Pages and D1 permissions
- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as GitHub Actions secrets

---

## One-Time Setup

### 1. Create the D1 database

```bash
# Install wrangler if you haven't
npm install -g wrangler

# Log in to Cloudflare
wrangler login

# Create the D1 database
wrangler d1 create fairtab
```

Copy the `database_id` from the output.

### 2. Update wrangler.toml

Open `wrangler.toml` and paste your `database_id`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "fairtab"
database_id = "PASTE-YOUR-ID-HERE"   # ← replace this
```

### 3. Apply the initial migration

```bash
wrangler d1 execute fairtab --remote --file=migrations/0001_initial.sql
```

### 4. Create the CF Pages project

```bash
# Build locally first
npm run pages:build

# Deploy for the first time (creates the project in CF Pages)
wrangler pages deploy .vercel/output/static --project-name=fairtab
```

### 5. Add GitHub Secrets

In your GitHub repository → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Your CF API token |
| `CLOUDFLARE_ACCOUNT_ID` | Your CF account ID (found in CF dashboard) |

---

## Automated Deployment

After setup, every push to `main` automatically:
1. Builds the app with `npm run pages:build`
2. Applies D1 migrations
3. Deploys to Cloudflare Pages

This is handled by `.github/workflows/deploy.yml`.

---

## How the Database Client Works

On Cloudflare Pages, the app detects the CF Workers runtime by checking for `globalThis[Symbol.for('__cloudflare-request-context__')]`. This global is injected by CF Workers before every request and contains the D1 binding.

```
Request arrives → CF Workers runtime injects __cloudflare-request-context__
                → getDb() detects the context
                → returns drizzle-orm/d1 client
                → queries go to D1
```

On local dev / self-hosted Docker, this global is never set, so `getDb()` falls back to `better-sqlite3`.

No environment variable switching required — the detection is automatic at runtime.

---

## Local Development Against a Local D1

For testing CF Pages behavior locally:

```bash
# Build for CF Pages
npm run pages:build

# Run with wrangler (uses local D1 via miniflare)
wrangler pages dev .vercel/output/static --d1=DB
```

This starts the app at `http://localhost:8788` with a local D1 database. The local D1 is stored in `.wrangler/state/`.

---

## D1 Limits (Free Tier)

| Metric | Free limit |
|---|---|
| Reads per day | 5 million |
| Writes per day | 100,000 |
| Storage | 5 GB |

These limits are very generous for a personal or small-team app.

---

## Environment Variables on CF Pages

Set these in Cloudflare Pages dashboard → Settings → Environment Variables:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://fairtab.pages.dev` (or your custom domain) |

D1 is accessed via the binding — no `DATABASE_URL` needed.

---

## Custom Domain

In Cloudflare Pages dashboard → Custom Domains → add your domain. CF handles the DNS and SSL certificate automatically.

---

## Migrations

When the schema changes:

```bash
# Generate a new migration
npm run db:generate

# Apply to remote D1
wrangler d1 execute fairtab --remote --file=lib/db/migrations/XXXX_new_migration.sql
```

Update `migrations/0001_initial.sql` or add a new migration file and update the GitHub Actions workflow to run it.
