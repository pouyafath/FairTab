# FairTab

Split expenses with friends. Free, unlimited, no ads.

FairTab is a Splitwise alternative. One codebase runs on **iOS, Android and the web** (Expo / React Native), with **Supabase** (Postgres + sign-in) as the backend.

- [PLAN.md](PLAN.md): product plan, roadmap, costs, how it could make money
- [docs/COMPARISON.md](docs/COMPARISON.md): FairTab vs Splitwise vs the first FairTab

> **Looking for the first FairTab (Next.js + SQLite)?** It is kept, unchanged, on the
> `legacy/nextjs` branch. Its newest unmerged work ("v2": recurring transactions, savings goals,
> receipts, PIN lock) is kept on the `legacy/nextjs-v2` branch.

## What it does

- Sign in with your email and a one-time code. No passwords.
- Groups. You can add people by name before they join.
- An invite link. People who open it can join, or pick their name ("I am Sara") to take over expenses already added for them.
- Expenses with **one or several payers**, split **equally, by exact amounts, by percent or by shares**. Rounding is fair, so splits always add up to the cent.
- **Categories and notes** on expenses.
- **Multiple currencies**, with balances kept separately per currency.
- Balances, **simplified debts** (on/off per group), and recording payments to settle up.
- A **"Copy Interac e-Transfer message"** button for CAD groups (and a plain payment message for other currencies).
- **Friends tab:** your balance with each person, added up across all groups.
- Activity feed. Edit and delete expenses.
- **Archive** a finished group: it becomes read-only and moves to the bottom of the list. **Recently deleted** brings back deleted expenses and payments.
- Remove people or leave a group once settled up. The group's creator can delete the group.
- **Import from Splitwise:** the CSV export of a group, including history, payments and balances.
- **Invite-only mode:** only people whose email you list can create an account.
- Light and dark mode.

## Project layout

```
src/domain/          Money logic with no UI: amounts, splits, balances, debt simplification, Splitwise import (unit tested)
src/lib/             Supabase client, data queries, balance helpers for screens
src/app/             Screens (Expo Router: every file is a screen)
src/components/      Shared UI pieces
supabase/migrations/ Database tables, security rules and server functions
supabase/tests/      Database tests (run on a plain local Postgres)
.github/workflows/   CI checks, and publishing the web app to GitHub Pages
```

Money is always stored as whole cents (`bigint`), never as floating point numbers.
Every expense or payment stores, for each person, how much they **paid** and how much they **owed**. The database refuses to save an entry unless paid = owed = amount.
Security lives in the database: row-level security means people can only read groups they belong to. Expenses, payments and membership changes go through server functions that check membership and the numbers; renaming a group, a person or your own profile is a direct write that row-level security limits to group members.

## Set up the backend (free, about 20 minutes)

1. Create a free account and project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the whole of `supabase/migrations/20261026000000_init.sql` and click **Run**.
3. **Invite-only (recommended while it's just for you):** in **Table Editor → signup_allowlist**, add a row with your own email address, written in lowercase. Add each friend's email the same way. While this table has at least one row, nobody else can create an account. If you empty it, anyone can sign up.
4. **Sign-in emails.** Under **Authentication → Emails**, edit both the **"Confirm signup"** and the **"Magic Link"** templates so they show the code, for example `Your FairTab code is {{ .Token }}`. New users get the first email and returning users get the second. The app accepts 6–10 digit codes.
5. **Email sending.** Supabase's built-in sender only delivers to your own Supabase team, at about 2 emails per hour. To email friends, go to **Authentication → Emails → SMTP Settings** and use a Gmail account. This needs no domain of your own:
   - Turn on 2-Step Verification for the Google account, then create an **App password** at myaccount.google.com/apppasswords.
   - Host `smtp.gmail.com`, port `587` (or `465`), username: your Gmail address, password: the app password, sender: the same Gmail address.
   - (Resend or Brevo also work, but they need a domain you own.)
6. Under **Authentication → URL Configuration**, set **Site URL** to where the app will live, e.g. `https://pouyafath.github.io/FairTab/`.
7. Get the two values the app needs. Click **Connect** at the top of the dashboard, or open **Project Settings**:
   - the **Project URL**, under **Data API**;
   - the **Publishable key** (starts with `sb_publishable_`), under **API Keys**. If your project only shows legacy keys, use the `anon` key.

   Never use the secret key (`sb_secret_…`) or the `service_role` key in the app.

## Database updates

Already set up the backend? Run each new file below in the SQL Editor, in order (open it on GitHub, click Raw, copy everything, paste, Run):

- `supabase/migrations/20261027000100_archive_and_restore.sql`: lets members archive a group so it becomes read-only (and unarchive it again).

## Put it online for free (GitHub Pages)

This repository is public, so GitHub Pages is free. Every push to `main` rebuilds the site.

1. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables** tab → add:
   - `SUPABASE_URL` = your Project URL
   - `SUPABASE_KEY` = your publishable (anon) key

   These two values are public by design: they end up in the web page. Your data is protected by the database rules and by sign-in.
3. **Actions → Deploy web app → Run workflow** (or push to `main`).
4. Open `https://pouyafath.github.io/FairTab/`. On a phone, use **Share → Add to Home Screen** to get an app icon.

Good to know:
- Supabase's free plan **pauses a project after 7 days without activity**. Open the dashboard and click **Restore** soon. A paused free project can only be restored for a limited time (Supabase has used 90 days and, more recently, up to a year). After that you can only download its backup and load it into a new project.
- The free plan has no backups you can restore yourself, so keep your own copy now and then. The simplest way: in **Table Editor**, open each table (`groups`, `group_members`, `expenses`, `expense_shares`, `profiles`) and use **Export → CSV**. Advanced: `pg_dump` with the connection string from **Connect**, or `npx supabase db dump` (needs Docker). Save backups **outside this folder** (for example in your Documents): this repository is public, and a backup contains everyone's names and expenses.
- Optional custom domain: add it under Settings → Pages, then add a repository variable `WEB_URL` (for example `https://fairtab.example.com`) so the app is built for the root of that domain.
- Other free hosts also work, since the web build is a plain static site: Cloudflare Pages (works with private repositories too), Netlify, Vercel. Point them at `npx expo export --platform web` with output folder `dist`, and make sure unknown paths fall back to `index.html`.

## Run it on your computer or phone

```bash
cp .env.example .env      # fill in the URL and publishable key from Supabase
npm install
npx expo start            # press w for web, or scan the QR code with the Expo Go app on your phone
```

## Checks

```bash
npm test                  # unit tests for the money logic
npm run typecheck
npm run lint
npm run test:db           # database tests; needs a local Postgres where you are a superuser
```

These run automatically on every pull request (`.github/workflows/ci.yml`).

## Phone apps in the stores (later)

`npx eas-cli@latest build` builds the iOS and Android apps in the cloud, and `eas submit` sends them to the stores. You need an Apple Developer account ($99/year) and a Google Play account ($25 once).
Cloud builds don't see your `.env` file, so first store the settings in EAS:

```bash
npx eas-cli@latest env:create --environment production --visibility plaintext --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR-PROJECT.supabase.co
npx eas-cli@latest env:create --environment production --visibility plaintext --name EXPO_PUBLIC_SUPABASE_KEY --value YOUR-PUBLISHABLE-KEY
npx eas-cli@latest env:create --environment production --visibility plaintext --name EXPO_PUBLIC_WEB_URL --value https://pouyafath.github.io/FairTab
```

`EXPO_PUBLIC_WEB_URL` makes invite links shared from the phone app open in the browser for friends who don't have the app.
Replace the placeholder icon and splash image in `assets/images/` first.
