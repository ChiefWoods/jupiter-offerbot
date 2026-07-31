import type { AppType } from "@jupiter-offerbot/api/rpc";
import { hc } from "hono/client";

export type ChannelPlatform = "discord" | "telegram";

export type CreateSubscriptionInput = {
  platform: ChannelPlatform;
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
  update(id: string, maxApy: number | null): Promise<void>;
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
  platform: ChannelPlatform,
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
        { query: { platform, userId } },
        { headers },
      );
      await throwForError(response);
      return (await response.json()).subscriptions;
    },
    async update(id, maxApy) {
      const response = await api.v1.subscriptions[":id"].$patch(
        { param: { id }, json: { maxApy } },
        { headers },
      );
      await throwForError(response);
    },
    async remove(id) {
      const response = await api.v1.subscriptions[":id"].$delete({ param: { id } }, { headers });
      await throwForError(response);
      return response.status === 204;
    },
  };
}
