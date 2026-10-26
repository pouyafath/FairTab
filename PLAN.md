# FairTab: product plan

## The idea

Splitwise is the app everyone knows. Since 2023 its free plan has limited how many expenses you can add per day (now about 2–3), added waiting times and shown more ads. Many long-time users are unhappy and looking for an alternative.

FairTab is a Splitwise-quality app with one promise:

> **Everything you need to split expenses is free forever. No daily limits. No ads in the core app.**

Money comes from **optional extras** that cost us real money to provide, or that only heavy users want. Nobody is forced to pay.

## The gap in the market (October 2026)

| App | Problem |
|---|---|
| Splitwise | Daily expense limit, ads, paywall |
| Tricount | Free, but balances only inside one group. No running balance with each friend across groups. |
| Settle Up | Ads and a paywall, the same model as Splitwise |
| Splid | No accounts or cloud sync across devices, few features |
| Spliit | Free and open source, but web only and no accounts. No balance with each friend across groups. |
| SplitPro | Open source, but you must host your own server |

Nobody offers all of these together: **free + unlimited + native phone apps + accounts + balances per friend across groups + one-tap Splitwise import.**

## Principles

1. Core features are free forever: unlimited expenses, groups and friends, every split method, multiple currencies, settling up, history and export.
2. No ads in the core screens. If ads ever come, they must be small and optional (for example, people who want to support the app can opt in).
3. Paid extras only cover things that cost money to run, or that are clearly "nice to have".
4. Switching must be effortless: import from Splitwise, and friends can join through a link.
5. Your data is yours: export at any time.

## Roadmap

### v0.1, the first version (built)
Sign in with an email code, groups, people added by name, invite link and claiming your name, several payers per expense, four split methods, categories and notes, multiple currencies, balances, simplified debts, settle up with an Interac e-Transfer message, friends across groups, activity, edit and delete, removing people and leaving once settled, deleting a group, invite-only sign-up, Splitwise CSV import, web + iOS + Android from one codebase, free hosting on GitHub Pages.

### v0.2: ready for friends (next 2–4 weeks)
- Sign in with Google and Apple (Apple is required on iOS if you offer Google).
- Push notifications ("Sara added Dinner – you owe €12").
- Live updates when someone else adds an expense (Supabase Realtime).
- Category icons and a real date picker.
- A currency picker instead of typing the 3-letter code.
- Archive groups (read-only), from the first FairTab.
- Comments on expenses.
- Undo delete (the database already keeps deleted expenses and has a restore function).
- Export a group to CSV (in Splitwise's format, so it can be imported back).
- Your own icon, name and colors.
- Custom SMTP for emails, a privacy policy page and a "delete my account" option (the App Store and Google Play require these).

### v0.3: launch (month 2–3)
- Works offline: add expenses without internet, synced later.
- Recurring expenses (rent and subscriptions every month), reusing the design from the first FairTab's v2 branch: anchor day, no duplicates, run on a schedule.
- Receipt photos, stored in Supabase Storage (the first FairTab's v2 branch had this for self-hosting).
- Optional "Personal" tab for your own income and spending, from the first FairTab, if you still want it.
- Currency conversion: "show everything in EUR". Splitwise charges for this; we give it away, using a free exchange-rate API.
- Search and filters.
- CSV and PDF export.
- Translations (English plus Persian, with right-to-left layout).
- Publish to the App Store, Google Play and the web.

### v1.0 and paid extras: "FairTab Plus" (month 4–12)
Only once there are real users. Ideas for paid features:
- **Receipt scanning:** take a photo and the app fills in the amount and items. This costs us money per scan (AI/OCR).
- **Itemized bills:** split a restaurant receipt item by item.
- Charts and spending reports.
- Bank or card import.
- Themes and custom app icons.
- Priority support.

Suggested price: about **$1.99/month or $14.99/year**, cheaper than Splitwise Pro ($4.99/month), to make switching attractive.
Other income: a "support the app" tip jar, and later partner fees for payment links (Splitwise earns money this way too).

## Costs

| Item | Cost |
|---|---|
| Building it (you, with AI help) | Your time; about $0 in money |
| Apple Developer account | $99 / year |
| Google Play account | $25 once |
| Domain name | ~$15 / year |
| Supabase (database, login) | $0 on the free plan. **$25/month** for the Pro plan once real people use it, because free projects pause after a week without activity and have no backups. |
| Email sending (login codes) | $0 up to a few thousand emails/month, then ~$20/month |
| Web hosting | $0 (Cloudflare Pages, Netlify or Vercel free plans) |
| Building phone apps (EAS) | $0 on the free plan, which has a monthly build limit |

**First year: about $150 before launch, then about $25–50/month once people really use it.** A Supabase Pro project comfortably handles tens of thousands of active users of an app like this.

## When it can make money

Apps like this typically convert **2–5% of active users** into paying users.

| Monthly active users | Paying (3%) at ~$15/year | Revenue / year | Costs / year |
|---|---|---|---|
| 1,000 | 30 | ~$450 | ~$450 |
| 10,000 | 300 | ~$4,500 | ~$600 |
| 100,000 | 3,000 | ~$45,000 | ~$3,000–6,000 |

- Months 0–3: build and launch. No income.
- Months 3–12: grow. Turn on the paid extras when there are roughly 5,000+ active users.
- Covering costs is realistic at about 1,000–2,000 active users. Real income needs tens of thousands.

## How to get the first users

1. **Splitwise refugees:** answer people complaining about the limits on Reddit (r/Splitwise, r/personalfinance, travel subreddits), on Trustpilot and on X. The message: "Free, no daily limit, imports your Splitwise history in one minute."
2. **Every group brings new users:** each invite link brings 2–5 people. Make joining take one tap.
3. **App Store search terms:** "Splitwise alternative", "split bills", "split expenses free".
4. **Product Hunt and Hacker News launch** ("I got tired of Splitwise's limits so I built a free one").
5. Your own friends and family first. Fix everything they complain about before the public launch.

## Risks

| Risk | What to do |
|---|---|
| People will not switch because their friends are on Splitwise | Splitwise import, plus friends can join through a link and claim their name |
| Splitwise removes its limits | Our promise is "free forever", written in public. Keep the app faster and simpler. |
| Running costs grow before income does | Costs are tiny per user. Paid extras cover the expensive features (receipt scanning). |
| A bug in money calculations destroys trust | Money logic is tested separately, and the database refuses entries that do not add up |
| Privacy and store rules | Privacy policy, account deletion, data export, and no tracking SDKs |

## Technical decisions

- **Expo (React Native) + TypeScript:** one codebase for iOS, Android and web, and phone apps are built in the cloud without needing a Mac.
- **Supabase:** Postgres database, login, and later realtime updates and file storage. Generous free plan, and it can be self-hosted or moved later because it is standard Postgres.
- **Security in the database:** row-level security means people can only ever read groups they are in. Expenses are written only through server functions that check the numbers add up. Tested in `supabase/tests/`.
- **Balances are calculated in the app** from all entries. That is simple and correct for normal use. If a group ever has tens of thousands of expenses, move the calculation into a database view.
