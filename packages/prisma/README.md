# `@jupiter-offerbot/prisma`

Shared PostgreSQL persistence boundary for Jupiter Offerbot. It exports `createPrismaClient`, generated Prisma types, and repositories for subscriptions, offer ingestion, and notification jobs.

## Data contract

- `subscriptions` stores a bridge platform, user ID, mint, and optional maximum APY in hundredths of a percent.
- `notification_jobs` is an outbox of matched offers. A unique `(subscription_id, offer_address)` pair makes offer replay idempotent.
- Pending jobs are claimed in a transaction with `FOR UPDATE SKIP LOCKED`, enabling safe concurrent worker replicas.

`createOfferRepository` creates matching notification jobs. `createSubscriptionRepository` owns platform-scoped CRUD and per-user limits. `createNotificationJobRepository` owns claiming plus delivery success or failure state transitions.

## Database commands

Set `DATABASE_URL`, then run these from the repository root:

```bash
bun run --cwd packages/prisma generate
bun run --cwd packages/prisma migrate:dev
bun run --cwd packages/prisma migrate:deploy
bun run --cwd packages/prisma studio
```
