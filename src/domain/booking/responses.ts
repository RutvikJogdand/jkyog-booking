import { z } from "zod";
import { FESTIVAL_DATES, PRODUCT_IDS } from "./types";

const cents = z.number().int().nonnegative();

export const quoteResponseSchema = z.strictObject({
  lines: z.array(
    z.strictObject({
      productId: z.enum(PRODUCT_IDS),
      description: z.string(),
      quantity: z.number().int().positive(),
      unitPriceCents: cents,
      amountCents: cents,
    }),
  ),
  subtotalCents: cents,
  discountCents: cents,
  totalCents: cents,
  currency: z.literal("USD"),
});

export const apiErrorSchema = z.strictObject({
  error: z.strictObject({
    code: z.string(),
    message: z.string(),
    fields: z.array(z.strictObject({ path: z.string(), message: z.string() })),
    productIds: z.array(z.enum(PRODUCT_IDS)).optional(),
  }),
});

export const checkoutSuccessSchema = z.strictObject({
  bookingId: z.string().min(1),
  receiptPath: z.string().regex(/^\/confirmation\/[A-Za-z0-9_-]{43}$/),
  quote: quoteResponseSchema,
});

const availabilityShape = Object.fromEntries(
  PRODUCT_IDS.map((id) => [id, z.number().int().nonnegative()]),
) as Record<(typeof PRODUCT_IDS)[number], z.ZodNumber>;

export const eventResponseSchema = z.strictObject({
  event: z.strictObject({
    name: z.string(),
    venue: z.string(),
    dates: z.array(z.enum(FESTIVAL_DATES)).length(FESTIVAL_DATES.length),
    currency: z.literal("USD"),
  }),
  products: z.array(
    z.strictObject({
      id: z.enum(PRODUCT_IDS),
      name: z.string(),
      unitPriceCents: cents,
    }),
  ),
  availability: z.strictObject(availabilityShape),
});

export type QuoteResponse = z.infer<typeof quoteResponseSchema>;
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;
export type EventResponse = z.infer<typeof eventResponseSchema>;
