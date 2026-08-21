import { betterFetch } from "@better-fetch/fetch";
import type { AppType } from "@jupiter-offerbot/api/rpc";
import type { hc, InferResponseType } from "hono/client";

export type ChannelPlatform = "discord" | "telegram";
export type SubscriptionType = "borrow" | "lend";

export type CreateSubscriptionInput = {
  platform: ChannelPlatform;
  userId: string;
  mint: string;
  type: SubscriptionType;
  maxApy: number | null;
};

export type Subscription = {
  id: string;
  mint: string;
  type: SubscriptionType;
  symbol: string | null;
  maxApy: number | null;
};

export type SubscriptionApi = {
  create(input: CreateSubscriptionInput): Promise<Subscription>;
  list(userId: string): Promise<Subscription[]>;
  update(id: string, maxApy: number | null): Promise<void>;
  remove(id: string): Promise<boolean>;
};

type ApiClient = ReturnType<typeof hc<AppType>>;
type CreateSubscriptionResponse = InferResponseType<ApiClient["v1"]["subscriptions"]["$post"], 201>;
type ListSubscriptionsResponse = InferResponseType<ApiClient["v1"]["subscriptions"]["$get"]>;

export class ApiClientError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

export function createSubscriptionApi(
  baseUrl: string,
  token: string,
  platform: ChannelPlatform,
): SubscriptionApi {
  const request = async <T>(
    path: string,
    options: { method: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown; query?: unknown },
  ): Promise<T> => {
    const { data, error } = await betterFetch<T, { error?: { code?: string } }>(path, {
      baseURL: baseUrl,
      auth: { type: "Bearer", token },
      ...options,
      retry: {
        type: "exponential",
        attempts: 5,
        baseDelay: 500,
        maxDelay: 4_000,
        shouldRetry: (response) => response !== null && [502, 503, 504].includes(response.status),
      },
    });

    if (error) {
      throw new ApiClientError(error.error?.code ?? "REQUEST_FAILED");
    }
    return data;
  };

  return {
    async create(input) {
      return (
        await request<CreateSubscriptionResponse>("/v1/subscriptions", {
          method: "POST",
          body: input,
        })
      ).subscription;
    },
    async list(userId) {
      return (
        await request<ListSubscriptionsResponse>("/v1/subscriptions", {
          method: "GET",
          query: { platform, userId },
        })
      ).subscriptions;
    },
    async update(id, maxApy) {
      await request(`/v1/subscriptions/${id}`, { method: "PATCH", body: { maxApy } });
    },
    async remove(id) {
      await request(`/v1/subscriptions/${id}`, { method: "DELETE" });
      return true;
    },
  };
}
