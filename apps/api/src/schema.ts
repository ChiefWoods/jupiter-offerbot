import { isAddress } from "@solana/kit";
import { z } from "zod";

export const PlatformSchema = z.enum(["discord", "telegram"]);
export type Platform = z.infer<typeof PlatformSchema>;
export const SubscriptionTypeSchema = z.enum(["borrow", "lend"]);
export type SubscriptionType = z.infer<typeof SubscriptionTypeSchema>;

export const CreateSubscriptionSchema = z.object({
  platform: PlatformSchema,
  userId: z.string().min(1).max(128),
  mint: z.string().refine(isAddress, "Must be a Solana address"),
  type: SubscriptionTypeSchema,
  maxApy: z.number().int().nullable(),
});

export type CreateSubscription = z.infer<typeof CreateSubscriptionSchema>;

export const UpdateSubscriptionSchema = z.object({
  maxApy: z.number().int().nullable(),
});

export type UpdateSubscription = z.infer<typeof UpdateSubscriptionSchema>;

export const OfferCreatedSchema = z.object({
  offerAddress: z.string().min(1),
  mint: z.string().refine(isAddress, "Must be a Solana address"),
  type: SubscriptionTypeSchema,
  apy: z.number().int(),
  signature: z.string().min(1),
  slot: z.number().int().nonnegative(),
  listedAt: z.iso.datetime(),
});

export type OfferCreated = z.infer<typeof OfferCreatedSchema>;

export const NotificationEnvelopeSchema = z.object({
  notificationId: z.string().uuid(),
  subscriptionId: z.string().uuid(),
  userId: z.string().min(1),
  offerAddress: z.string().min(1),
  mint: z.string().min(1),
  symbol: z.string().nullable(),
  apy: z.number().int(),
  signature: z.string().min(1),
  listedAt: z.iso.datetime(),
});

export type NotificationEnvelope = z.infer<typeof NotificationEnvelopeSchema>;
