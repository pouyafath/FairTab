# Cloudflare Pages + D1 Deployment

Deploy FairTab to Cloudflare Pages for managed cloud hosting. FairTab uses Cloudflare D1
(serverless SQLite) as the database.

> **Access warning:** FairTab currently has no authentication or per-user data isolation. Anyone
> with a group token can manage that group, and anyone who can access `/personal` can view the
> instance's personal transactions. Do not use a public deployment for sensitive personal data.
> See [project-overview.md](project-overview.md#data-and-trust-model).

---

## Overview

| | |
|---|---|
| **Platform** | Cloudflare Pages (free tier) |
| **Database** | Cloudflare D1 (serverless SQLite) |
| **Runtime** | Cloudflare Workers (Edge, Node.js compat) |
| **CI/CD** | GitHub Actions deploys on pushes to `main` |

### Feature differences vs Docker self-hosting

- **Receipt attachments are disabled** — there is no local filesystem on Workers; the upload
  UI is hidden and the API returns `501`. Use the Docker deployment if you need receipts.
- **JSON backup export and dry-run validation work. Restore execution does not** — the
  restore transaction uses SQL statements D1 rejects, so the request fails before any data
  is modified. To move data onto D1, seed it with `wrangler d1 execute`; to migrate off,
  export here and restore into a Docker/local deployment.
- **Access gate works** — set `APP_ACCESS_PIN` in the Pages project's environment variables.

---

## Prerequisites

- A Cloudflare account ([cloudflare.com](https://cloudflare.com)) — free
- Cloudflare API token with Pages and D1 permissions
- `wrangler` logged in locally for one-time setup
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

The deployment workflow uses GitHub repository secrets. Create these under Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Your CF API token |
| `CLOUDFLARE_ACCOUNT_ID` | Your CF account ID (found in CF dashboard) |

---

## Automated Deployment

After setup, every push to `main` automatically:
1. Build the app with `npm run pages:build`
2. Apply D1 migrations
3. Deploy to Cloudflare Pages

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

## Platform Limits

Cloudflare limits and pricing can change. Check the official documentation before choosing this
deployment model:

- [Cloudflare D1 limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits/)
- [Cloudflare Pages Functions pricing](https://developers.cloudflare.com/pages/functions/pricing/)

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
