import { z } from "zod";

const EnvSchema = z.object({
  REFERRAL_UUID: z.uuid().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  return EnvSchema.parse(source);
}

export const env = parseEnv(process.env);
