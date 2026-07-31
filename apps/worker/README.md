# `@jupiter-offerbot/worker`

Polling Bun worker that delivers pending Offerbot notification jobs to Discord and Telegram bridge webhooks.

Each delivery includes `x-offerbot-delivery-id`, a Unix-second `x-offerbot-timestamp`, and an HMAC-SHA256 `x-offerbot-signature` over `timestamp.rawBody`.

## Configuration

```bash
cp apps/worker/.env.example apps/worker/.env
```

## Run

```bash
bun run --cwd apps/worker start
bun run --cwd apps/worker typecheck
```
