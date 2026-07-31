import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3002),
  API_BASE_URL: z.url(),
  TELEGRAM_BRIDGE_TOKEN: z.string().min(1),
  TELEGRAM_WEBHOOK_SECRET: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  CORS_ALLOWED_ORIGIN: z
    .string()
    .default("*")
    .transform((origins) =>
      origins
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  return EnvSchema.parse(source);
}

export const env = parseEnv(process.env);
