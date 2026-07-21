import { z } from "zod";

export const packIdBodySchema = z.object({
  packId: z.string().min(1),
});

export const purchaseConfirmBodySchema = z.object({
  purchaseId: z.string().min(1),
  sessionId: z.string().min(1).optional(),
});

export const redeemRequestBodySchema = z.object({
  bundleId: z.string().min(1),
  payoutMethod: z.enum(["gcash", "maya", "bank"]).default("gcash"),
  accountName: z.string().min(1),
  accountNumber: z.string().min(1),
  bankName: z.string().optional(),
  /** @deprecated — accepted for older clients */
  gcashNumber: z.string().optional(),
  gcashName: z.string().optional(),
});

export const adminPayBodySchema = z.object({
  requestId: z.string().min(1),
});

export const adminResolveBodySchema = z.object({
  requestId: z.string().min(1),
  action: z.enum(["paid", "reject"]),
  adminNote: z.string().optional(),
});

export const adjustCoinsBodySchema = z.object({
  uid: z.string().min(1),
  amount: z.number().finite().refine((n) => n !== 0, {
    message: "uid and a non-zero amount are required.",
  }),
  reason: z.string().optional(),
});

export function zodErrorMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid request body.";
}
