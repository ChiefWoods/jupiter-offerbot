# `@jupiter-offerbot/discord`

Discord bridge for Jupiter Offerbot. It is a user-installed app: users add it to
their own Discord account, interact with it in a direct message, and receive
matching Offerbook notifications in that same conversation.

## Commands

| Command                                                                | Description                                   |
| ---------------------------------------------------------------------- | --------------------------------------------- |
| `/offerbot`                                                            | Introduces Offerbot.                          |
| `/list`                                                                | Lists your watched mints.                     |
| `/watch mint:<base58> type:<borrow\|lend> max_apy:<decimal optional>`  | Watches or updates one offer type for a mint. |
| `/update mint:<base58> type:<borrow\|lend> max_apy:<decimal optional>` | Updates that typed watch's APY ceiling.       |
| `/unwatch mint:<base58> type:<borrow\|lend>`                           | Stops watching that offer type.               |

Display APYs use two decimal places, while requests to the API use integer hundredths of a percent.

## HTTP surface

- `GET /health` is the liveness endpoint.
- `POST /internal/notifications` accepts signed worker deliveries and sends a Discord direct message. It requires `x-offerbot-timestamp` and an HMAC-SHA256 `x-offerbot-signature`; timestamps more than five minutes old are rejected.

## Configuration

```bash
cp apps/discord/.env.example apps/discord/.env
```

## Discord setup

In the Discord Developer Portal, enable **User Install** under **Installation**
and add the `applications.commands` scope to its default settings. Users then
open the app's install link, choose **Add to My Apps**, and direct-message
Offerbot. No shared server is required.

## Run and check

```bash
bun run --cwd apps/discord dev
bun run --cwd apps/discord test
bun run --cwd apps/discord typecheck
```
