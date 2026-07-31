# `@jupiter-offerbot/api`

Hono API for Jupiter Offerbook event ingestion and notification-subscription management.

## Endpoints

| Route                          | Description                                                            |
| ------------------------------ | ---------------------------------------------------------------------- |
| `GET /health`                  | Liveness response.                                                     |
| `GET /ready`                   | Returns `503` when PostgreSQL cannot be queried.                       |
| `GET /v1/subscriptions`        | Lists a bridge user's subscriptions.                                   |
| `POST /v1/subscriptions`       | Creates a Discord or Telegram mint subscription.                       |
| `PATCH /v1/subscriptions/:id`  | Changes a subscription's APY ceiling.                                  |
| `DELETE /v1/subscriptions/:id` | Deletes a subscription.                                                |
| `POST /v1/offers`              | Accepts an Offerbook creation event and queues matching notifications. |

## Configuration

```bash
cp apps/api/.env.example apps/api/.env
```

## Run and check

```bash
bun run --cwd apps/api start
bun run --cwd apps/api test
bun run --cwd apps/api typecheck
```

The Bruno collection in [`bruno/`](bruno/) provides local requests for the ingestion and subscription routes.
