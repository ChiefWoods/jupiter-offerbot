import { z } from "zod";

const EnvSchema = z.object({
  GRPC_ENDPOINT: z.url(),
  GRPC_TOKEN: z.string().min(1).optional(),
  SOLANA_RPC_URL: z.url(),
  API_BASE_URL: z.url(),
  LISTENER_API_TOKEN: z.string().min(1),
});

export type Env = z.infer<typeof EnvSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  return EnvSchema.parse(source);
}

export const env = parseEnv(process.env);
