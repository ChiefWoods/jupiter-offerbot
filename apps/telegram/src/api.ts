import type { AppType } from "@jupiter-offerbot/api/rpc";
import { hc } from "hono/client";

type CreateSubscriptionInput = {
  platform: "telegram";
  userId: string;
  mint: string;
  maxApy: number | null;
};

export type Subscription = {
  id: string;
  mint: string;
  maxApy: number | null;
};

export type SubscriptionApi = {
  create(input: CreateSubscriptionInput): Promise<void>;
  list(userId: string): Promise<Subscription[]>;
  remove(id: string): Promise<boolean>;
};

export class ApiClientError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export function createSubscriptionApi(
  baseUrl: string,
  token: string,
  send: typeof fetch = fetch,
): SubscriptionApi {
  const api = hc<AppType>(baseUrl, { fetch: send });
  const headers = { authorization: `Bearer ${token}` };
  const throwForError = async (response: { ok: boolean; json(): Promise<unknown> }) => {
    if (response.ok) return;
    const body = (await response.json().catch(() => undefined)) as
      | { error?: { code?: string } }
      | undefined;
    throw new ApiClientError(body?.error?.code ?? "REQUEST_FAILED");
  };
  return {
    async create(input) {
      const response = await api.v1.subscriptions.$post({ json: input }, { headers });
      await throwForError(response);
    },
    async list(userId) {
      const response = await api.v1.subscriptions.$get(
        { query: { platform: "telegram", userId } },
        { headers },
      );
      await throwForError(response);
      return (await response.json()).subscriptions;
    },
    async remove(id) {
      const response = await api.v1.subscriptions[":id"].$delete({ param: { id } }, { headers });
      await throwForError(response);
      return response.status === 204;
    },
  };
}
