import { z } from "zod";
import {
  FESTIVAL_DATES,
  PRODUCT_IDS,
  WORKSHOP_DATES,
} from "@/domain/booking/types";
import { TEXT_LIMITS } from "@/domain/booking/validation";

// Shape checks only. Booking rules, with their explanatory messages, live in
// src/domain/booking/validation.ts. Strict objects reject unknown fields such as
// browser-supplied prices or discounts.

const id = z.string().min(1).max(100);
const festivalDate = z.enum(FESTIVAL_DATES);
const datesList = z.array(festivalDate).max(FESTIVAL_DATES.length);
const ticketCategory = z.enum(["adult", "child"]);

const admission = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("day"),
    category: ticketCategory,
    dates: datesList,
  }),
  z.strictObject({ kind: z.literal("all_days"), category: ticketCategory }),
  z.strictObject({ kind: z.literal("family"), familyId: id }),
  z.strictObject({ kind: z.literal("free"), dates: datesList }),
]);

const attendee = z.strictObject({
  id,
  name: z.string().max(TEXT_LIMITS.name),
  firstVisitDate: festivalDate,
  ageAtFirstVisit: z.number(),
  admission,
});

const familyGroup = z.strictObject({ id, dates: datesList });

const extras = z.strictObject({
  sticksPairs: z.number(),
  dinners: z.array(z.strictObject({ attendeeId: id, date: festivalDate })),
  workshops: z.array(
    z.strictObject({ attendeeId: id, date: z.enum(WORKSHOP_DATES) }),
  ),
});

export const selectionSchema = z.strictObject({
  attendees: z.array(attendee),
  familyGroups: z.array(familyGroup),
  extras,
  promoCode: z.string().max(TEXT_LIMITS.promo).optional(),
});

export const quoteRequestSchema = z.strictObject({
  selection: selectionSchema,
});

const booker = z.strictObject({
  name: z.string().max(TEXT_LIMITS.name),
  email: z.string().max(TEXT_LIMITS.email),
  age: z.number(),
  phone: z.string().max(TEXT_LIMITS.phone).optional(),
});

export const checkoutRequestSchema = z.strictObject({
  booker,
  selection: selectionSchema,
  expectedTotalCents: z.number().int().nonnegative(),
  simulation: z.enum(["success", "decline"]),
});

export const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_-]{16,128}$/);

const cents = z.number().int().nonnegative();

// Saved quotes are read back from JSONB, so they are checked rather than trusted.
export const quoteSchema = z.strictObject({
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
