# `@jupiter-offerbot/telegram`

Telegram bridge for Jupiter Offerbot. It lets users manage mint watches in private chats and delivers matching Offerbook notifications from the worker.

## Commands

| Command                                  | Description                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| `/start`                                 | Shows Offerbot help.                                                              |
| `/list`                                  | Lists watched mints and their optional APY ceilings.                              |
| `/watch <borrow\|lend> <mint> [max_apy]` | Watches one offer type for a Solana mint, optionally up to an APY such as `7.25`. |
| `/unwatch <borrow\|lend> <mint>`         | Stops watching that offer type.                                                   |

Commands are available only in direct messages. Display APYs use two decimal places, while requests to the API use integer hundredths of a percent.

## HTTP surface

- `GET /health` is the liveness endpoint.
- `POST /internal/notifications` accepts worker deliveries and sends a Telegram message. It requires `x-offerbot-timestamp` and an HMAC-SHA256 `x-offerbot-signature`; timestamps more than five minutes old are rejected.

## Configuration

```bash
cp apps/telegram/.env.example apps/telegram/.env
```

## Run and check

```bash
bun run --cwd apps/telegram dev
bun run --cwd apps/telegram test
bun run --cwd apps/telegram typecheck
```
