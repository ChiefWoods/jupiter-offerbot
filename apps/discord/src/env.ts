import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  API_BASE_URL: z.url(),
  DISCORD_BRIDGE_TOKEN: z.string().min(1),
  DISCORD_WEBHOOK_SECRET: z.string().min(1),
  DISCORD_BOT_TOKEN: z.string().min(1),
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
