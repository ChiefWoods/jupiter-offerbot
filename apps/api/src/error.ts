export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "PLATFORM_MISMATCH"
  | "SUBSCRIPTION_LIMIT_REACHED"
  | "SUBSCRIPTION_ALREADY_EXISTS"
  | "SUBSCRIPTION_NOT_FOUND"
  | "MINT_METADATA_UNAVAILABLE";

const details: Record<
  ApiErrorCode,
  { message: string; status: 400 | 403 | 404 | 409 | 429 | 503 }
> = {
  INVALID_REQUEST: { message: "Invalid request.", status: 400 },
  PLATFORM_MISMATCH: { message: "Platform does not match credentials.", status: 403 },
  SUBSCRIPTION_LIMIT_REACHED: { message: "Subscription limit reached.", status: 429 },
  SUBSCRIPTION_ALREADY_EXISTS: { message: "Subscription already exists.", status: 409 },
  SUBSCRIPTION_NOT_FOUND: { message: "Subscription not found.", status: 404 },
  MINT_METADATA_UNAVAILABLE: {
    message: "Token metadata is unavailable. Please try again later.",
    status: 503,
  },
};

export class ApiError extends Error {
  readonly status: 400 | 403 | 404 | 409 | 429 | 503;

  constructor(readonly code: ApiErrorCode) {
    super(details[code].message);
    this.status = details[code].status;
  }
}
