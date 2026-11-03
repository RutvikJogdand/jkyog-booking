import { priceSelection } from "@/domain/booking/pricing";
import { applyPromotion, type PromoOutcome } from "@/domain/booking/promotions";
import type { Quote, Selection } from "@/domain/booking/types";
import { validateSelection } from "@/domain/booking/validation";
import { PRICES, PROMOS } from "./catalog";
import type { FieldError } from "./http-errors";

export type QuoteResult =
  { ok: true; quote: Quote } | { ok: false; fields: FieldError[] };

// Paths in `fields` are relative to the request body, e.g. "selection.promoCode".
export function quoteSelection(selection: Selection): QuoteResult {
  const issues = validateSelection(selection);
  if (issues.length > 0) {
    return {
      ok: false,
      fields: issues.map(({ path, message }) => ({
        path: `selection.${path}`,
        message,
      })),
    };
  }

  const priced = priceSelection(selection, PRICES);
  const promo = applyPromotion(selection.promoCode, priced, PROMOS);
  if (promo.status === "rejected") {
    return {
      ok: false,
      fields: [{ path: "selection.promoCode", message: promoMessage(promo) }],
    };
  }

  return {
    ok: true,
    quote: {
      lines: priced.lines,
      subtotalCents: priced.subtotalCents,
      discountCents: promo.discountCents,
      totalCents: priced.subtotalCents - promo.discountCents,
      currency: "USD",
    },
  };
}

function promoMessage(promo: Extract<PromoOutcome, { status: "rejected" }>) {
  switch (promo.reason) {
    case "expired":
      return `${promo.code} has expired.`;
    case "usage_limit_reached":
      return `${promo.code} has reached its usage limit.`;
    case "not_recognised":
      return "This code is not recognised.";
    case "below_minimum":
      return `${promo.code} needs a subtotal of at least ${formatUsd(promo.minimumSubtotalCents)}, including extras.`;
    case "no_eligible_items":
      return "This code only applies to child tickets.";
  }
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
