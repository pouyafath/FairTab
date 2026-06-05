# Project Overview

FairTab is a free, open-source web application for two related tasks:

1. Splitting shared expenses among a trusted group
2. Tracking personal income and spending manually

It is designed for people who want a small, understandable finance tool without bank
connections, payment processing, subscriptions, ads, or required user accounts. FairTab is
Canada-friendly by default, with CAD as the default currency and Interac e-Transfer message
generation for settlements, while also supporting USD, EUR, and GBP.

---

## Who It Is For

FairTab works well for:

- Roommates and shared households
- Trips, dinners, events, and other short-lived groups
- Families or friends who trust everyone with the group link
- Individuals who want simple manual transaction tracking
- People who want to self-host their finance data

FairTab is not intended to be a bank replacement, accounting platform, payment processor, or
multi-tenant financial service.

---

## Core Product Areas

### Group Expense Splitting

A group represents a set of people sharing expenses in one currency.

Typical workflow:

1. Create a group and choose its currency.
2. Add members, optionally including an email address for Interac message text.
3. Share the group link or its 8-character token with trusted participants.
4. Add expenses and record who paid.
5. Split each expense equally, by exact amounts, by percentage, or by shares.
6. Review member balances and suggested payments.
7. Record completed settlements and undo them if needed.

Group owners and members are not separate roles. Anyone who has the group link can view and
manage the group, including its members and expenses.

### Personal Finance Tracking

The personal dashboard provides manual income and expense tracking:

- Add, edit, and delete transactions
- Categorize income and spending
- Add notes and account labels
- Review monthly income, expenses, net savings, and category totals
- View spending trends
- Export transactions as CSV

Personal transactions are stored in the deployment database. In the current no-auth version,
the personal dashboard is shared across the whole FairTab instance, not isolated per browser or
per person. Use it only on a private or trusted deployment.

---

## Data and Trust Model

FairTab deliberately avoids authentication in its current scope. That keeps setup simple, but it
also defines the security model:

| Data or setting | Where it is stored | Who can access it |
|---|---|---|
| Groups, members, expenses, and settlements | SQLite or Cloudflare D1 | Anyone with the group link or token |
| Personal transactions | SQLite or Cloudflare D1 | Anyone who can access the instance's personal dashboard |
| Recently visited groups | Browser `localStorage` | That browser profile only |
| Default currency setting | Browser `localStorage` | That browser profile only |

Important consequences:

- A group token acts like a shared secret. Treat the group URL as sensitive.
- There are no passwords, user roles, ownership checks, or per-user data partitions.
- FairTab does not encrypt application data at rest beyond what the host platform provides.
- Public deployments should not be used for sensitive personal finance data until
  authentication and access control are implemented.
- FairTab never connects to a bank and never initiates payments.

---

## Supported Currencies

FairTab currently supports:

- CAD
- USD
- EUR
- GBP

Each group uses one currency. FairTab does not perform exchange-rate conversion. Personal
transactions may use different currencies, but summary totals do not convert between them, so a
single currency is recommended for meaningful personal reports.

---

## How Calculations Work

All monetary values are stored as integer cents. For example, `$24.50` is stored as `2450`.
This avoids floating-point rounding errors.

Expense participant amounts are calculated when an expense is created or edited, then stored in
the database. Group balances are derived from:

```text
member net balance = total amount paid - total amount owed
```

A positive balance means the group owes that member. A negative balance means the member owes
the group. FairTab uses a greedy debt-simplification algorithm to produce a small set of
suggested payments.

See [architecture.md](architecture.md) for the application flow and
[database.md](database.md) for the schema.

---

## Deployment Model

The same application supports three environments:

| Environment | Runtime | Database | Typical use |
|---|---|---|---|
| Local development | Node.js | Local SQLite file | Development and testing |
| Docker self-hosting | Node.js | Bind-mounted SQLite file | Private long-term use |
| Cloudflare Pages | Cloudflare Workers | Cloudflare D1 | Managed hosting for a trusted audience |

The database adapter is selected at runtime. Local and Docker deployments use
`better-sqlite3`; Cloudflare Pages uses a D1 binding.

---

## Current Constraints

- No authentication, authorization, or user accounts
- No payment processing or bank integrations
- No automatic currency conversion
- No recurring transactions
- No receipt image attachments
- No group archiving
- No full-instance data deletion workflow

These constraints are intentional or known roadmap items. Changes that affect them should update
this document, the README, and the relevant technical documentation.

---

## Documentation Map

| Document | Purpose |
|---|---|
| [README.md](../README.md) | Project introduction and quick start |
| [development.md](development.md) | Local setup, scripts, project structure, and testing |
| [architecture.md](architecture.md) | Runtime design, boundaries, data flows, and algorithms |
| [database.md](database.md) | Schema, migrations, backups, and restore |
| [docker.md](docker.md) | Docker deployment details |
| [cloudflare.md](cloudflare.md) | Cloudflare Pages and D1 deployment |
| [contributing.md](contributing.md) | Contribution workflow and code conventions |
| [pouyafath/Phomeserver](https://github.com/pouyafath/Phomeserver) | Home-server OS, VPN, security, backups, and service operations |
