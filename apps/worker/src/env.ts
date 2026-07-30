import { z } from "zod";

const EnvSchema = z.object({
  DATABASE_URL: z.url(),
  DISCORD_WEBHOOK_URL: z.url(),
  DISCORD_WEBHOOK_SECRET: z.string().min(1),
  TELEGRAM_WEBHOOK_URL: z.url(),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
  OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1_000),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  return EnvSchema.parse(source);
}

export const env = parseEnv(process.env);
