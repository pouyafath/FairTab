# FairTab vs Splitwise vs the first FairTab

*October 2026.* "FairTab (new)" is this Expo + Supabase app. "FairTab v1" is the earlier Next.js + SQLite app, kept on the `legacy/nextjs` branch; "v2" means its newest unmerged work, kept on `legacy/nextjs-v2`.

Splitwise facts come from Splitwise's help center and app-store listings, plus third-party reviews where marked. Several Splitwise pages could not be opened directly, so some details rest on search summaries. Facts about both FairTab versions were checked against their code.

## Feature by feature

| Area | Feature | Splitwise Free | Splitwise Pro | FairTab (new) | FairTab v1 |
|---|---|---|---|---|---|
| **Cost & limits** | Price | $0 | ~$4.99/month or ~$39.99–49.99/year (third-party snapshots) | $0 | $0 |
| | Daily expense limit | **4 per day** (help center); 2–3 plus a ~10 s countdown in some reports | Unlimited | **Unlimited** | Unlimited |
| | Ads | Yes | No | **No** | No |
| **Access** | Accounts / sign-in | Yes | Yes | Yes: email code | **No**: anyone with a group link has full control |
| | Invite people | Yes | Yes | Invite link + "I am Sara" claim; link can be reset | Share the group link (can't be revoked) |
| | Keep it private to friends | n/a | n/a | Invite-only list of emails | No (optional PIN on v2 only) |
| | Who can edit | Any group member | Same | Any group member | Anyone with the link |
| **Groups & people** | Add people before they join | Yes | Yes | Yes | Yes |
| | Remove people / leave | Only when settled up | Same | Only when settled up; history kept | Only people with no expenses |
| | Delete group | Yes (restorable) | Same | Creator only (recoverable by you in Supabase) | Yes, by anyone with the link |
| | Archive group | Auto-hidden after 40+ days settled | Same | Not yet (planned) | Yes (mostly read-only) |
| | Expenses outside any group | Yes | Yes | No | No |
| **Expenses** | Equal / exact / percent / shares | Yes | Yes | Yes | Yes (whole % only) |
| | Adjustment, itemized, reimbursement splits | Yes (receipt-scan itemizing is Pro) | Yes | No | No |
| | Several payers for one expense | Yes | Yes | **Yes** | No |
| | Categories / notes | Yes | Yes | Yes / Yes | Yes / Yes |
| | Default split per group | No | Yes | No | No |
| | Receipt photos | 1 photo per expense | 10 GB + OCR scan | Not yet (planned) | Only on v2, self-hosted only |
| | Recurring expenses | Yes | Yes | Not yet (planned) | No (v2: personal only) |
| | Comments | Yes | Yes | No | No |
| **Balances** | Recording a payment reduces balances | Yes | Yes | Yes | **Bug on main**: payments are ignored (fixed on v2) |
| | Partial payments | Yes | Yes | Yes | No |
| | Simplify debts | Yes, per group | Yes | Yes, per group (on by default) | Always on |
| | Balance per friend across groups | Yes | Yes | **Yes** (Friends tab) | No |
| | Payment hand-off | Splitwise Pay/Venmo/PayPal (US; Venmo broken on Android since July 2026), Pay by Bank (UK, FR, DE, AT) | Same | Copy Interac e-Transfer message (CAD) | Copy Interac message |
| **Money** | Multiple currencies | Yes, separate balances | Yes | Yes, any currency | 4 currencies, one per group |
| | Currency conversion | No | Yes | No (planned, free) | No |
| **History & data** | Activity feed | Yes | Yes | Basic | No |
| | Restore deleted expense | Yes | Yes | In the database, no button yet | No |
| | Search | No | Yes | No | Personal ledger only |
| | Charts | Small chart | Full | No | Personal ledger only |
| | Export | CSV | CSV + JSON | Not yet (planned) | Personal CSV + full JSON backup (**open to anyone by default** on main) |
| | Import from Splitwise | n/a | n/a | **Yes** (CSV) | No |
| **Extras** | Personal finance (own income/spending) | No | No | No (possible later) | Yes (one shared ledger, no login) |
| | Notifications | Email/push | Same | No | No |
| **Platforms** | Web / iPhone / Android | Yes / Yes / Yes | Same | Yes / Yes / Yes from one codebase (store builds later) | Web + installable web app |
| | Offline | Yes (mobile) | Same | No | Shows cached pages only |
| | Dark mode | Yes | Yes | Yes (follows phone) | Only on v2 |
| | Languages | 7+ | Same | English (Persian planned) | English |
| **Running it** | Free hosting today | n/a | n/a | **Ready**: GitHub Pages + Supabase free plan | **Broken**: all 22 recorded cloud deploys failed; needs 3 fixes |
| | Backups | n/a | JSON download | Your own `supabase db dump` | JSON export/restore (restore likely fails on Cloudflare D1) |
| | Tests | n/a | n/a | 64 unit tests + database security tests, run in CI | 77 tests (129 on v2); CI red on main |

## Why the new app replaced the first FairTab

The first FairTab got a lot right:
- careful money maths in whole cents;
- a clean code structure;
- accessibility work;
- the Interac message.

But its foundations were missing three things: accounts, safe access control, and correct settle-up. Adding accounts would have meant changing every part of it, and the result would still have been web-only. The new app has these from the start and also runs on phones. Since the old server is gone, there was no live data to move.

**Carried over from v1 so far:**
- categories and notes;
- the Interac e-Transfer message;
- deleting a group;
- removing people only once they are settled up.

**Planned next:**
- archive groups;
- CSV export;
- search and filters;
- a currency picker;
- recurring expenses, using v2's design;
- receipt photos;
- optionally, the personal-finance tab.

**Not carried over:**
- group-link-only access;
- the separate settlements table and its pair-hiding logic;
- the cache-first service worker;
- the Docker/Cloudflare D1 setup;
- the PIN gate (real accounts replace it).

## Known bugs in the first FairTab (if you ever revive it)

1. **Balances ignore recorded payments**, and settle-up hides any pair that has ever paid each other (`lib/calculations/balances.ts`, `lib/backend/services/settlements.ts`). Fixed on v2.
2. **`/api/backups/export` gives the whole database to anyone** when `FAIRTAB_BACKUP_TOKEN` is not set (`lib/backups/auth.ts`). Fixed on v2.
3. **The Cloudflare deploy cannot work:**
   - the code looks for the old next-on-pages context symbol instead of OpenNext's `getCloudflareContext()` (`lib/db/index.ts:17`, `lib/backend/runtime.ts:21`; v2 too);
   - `compatibility_date` is from 2024;
   - the D1 database id is still a placeholder (`wrangler.toml`).
4. Group tokens are 8 characters and cannot be rotated. Anyone holding one can delete the group.
5. Default dates use UTC, so evenings in Canada default to tomorrow. Fixed on v2.
