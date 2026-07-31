# `@jupiter-offerbot/listener`

Long-running Bun service that watches Jupiter Offerbook transactions through Yellowstone gRPC and submits supported offer-creation events to the Offerbot API.

## Configuration

```bash
cp apps/listener/.env.example apps/listener/.env
```

## Run and check

```bash
bun run --cwd apps/listener start
bun run --cwd apps/listener test
bun run --cwd apps/listener typecheck
```
