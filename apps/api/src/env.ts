import { z } from "zod";

const positiveInteger = z.coerce.number().int().positive();

const EnvSchema = z.object({
  DATABASE_URL: z.url(),
  JUPITER_API_KEY: z.string().min(1),
  JUPITER_API_URL: z.url(),
  LISTENER_API_TOKEN: z.string().min(1),
  DISCORD_BRIDGE_TOKEN: z.string().min(1),
  TELEGRAM_BRIDGE_TOKEN: z.string().min(1),
  MAX_SUBSCRIPTIONS_PER_USER: positiveInteger,
  PORT: positiveInteger.default(3000),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default("*")
    .transform((origins) =>
      origins
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  REDIS_URL: z.url(),
  RATE_LIMIT_MAX_REQUESTS: positiveInteger.default(100),
  RATE_LIMIT_WINDOW_SECONDS: positiveInteger.default(60),
  RATE_LIMIT_TRUSTED_IP_HEADER: z.string().trim().min(1).optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  return EnvSchema.parse(source);
}

export const env = parseEnv(process.env);
