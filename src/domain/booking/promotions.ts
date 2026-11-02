import type { PricedSelection } from "./pricing";
import type { ProductId } from "./types";

export type PromoDefinition =
  | { kind: "percent_off_subtotal"; percent: number }
  | { kind: "flat_off"; amountCents: number; minimumSubtotalCents: number }
  | { kind: "products_free"; productIds: readonly ProductId[] }
  | { kind: "expired" }
  | { kind: "usage_limit_reached" };

// Codes match exactly: no trimming and no case folding, so "seva10" is not "SEVA10".
export type PromoTable = Readonly<Record<string, PromoDefinition>>;

export type PromoRejection =
  | { reason: "expired" }
  | { reason: "usage_limit_reached" }
  | { reason: "not_recognised" }
  | { reason: "below_minimum"; minimumSubtotalCents: number }
  | { reason: "no_eligible_items"; productIds: readonly ProductId[] };

export type PromoOutcome =
  | { status: "none"; discountCents: 0 }
  | { status: "applied"; code: string; discountCents: number }
  | ({ status: "rejected"; code: string; discountCents: 0 } & PromoRejection);

export function applyPromotion(
  code: string | undefined,
  priced: PricedSelection,
  promos: PromoTable,
): PromoOutcome {
  if (code === undefined || code === "") {
    return { status: "none", discountCents: 0 };
  }

  // Object.hasOwn keeps inherited names such as "constructor" from matching.
  const definition = Object.hasOwn(promos, code) ? promos[code] : undefined;
  const reject = (rejection: PromoRejection): PromoOutcome => ({
    status: "rejected",
    code,
    discountCents: 0,
    ...rejection,
  });

  switch (definition?.kind) {
    case undefined:
      return reject({ reason: "not_recognised" });
    case "expired":
      return reject({ reason: "expired" });
    case "usage_limit_reached":
      return reject({ reason: "usage_limit_reached" });
    case "percent_off_subtotal":
      return {
        status: "applied",
        code,
        discountCents: percentOfCentsRoundedHalfUp(
          priced.subtotalCents,
          definition.percent,
        ),
      };
    case "flat_off":
      if (priced.subtotalCents < definition.minimumSubtotalCents) {
        return reject({
          reason: "below_minimum",
          minimumSubtotalCents: definition.minimumSubtotalCents,
        });
      }
      return { status: "applied", code, discountCents: definition.amountCents };
    case "products_free": {
      const eligibleLines = priced.lines.filter((line) =>
        definition.productIds.includes(line.productId),
      );
      if (eligibleLines.length === 0) {
        return reject({
          reason: "no_eligible_items",
          productIds: definition.productIds,
        });
      }
      return {
        status: "applied",
        code,
        discountCents: eligibleLines.reduce(
          (sum, line) => sum + line.amountCents,
          0,
        ),
      };
    }
  }
}

function percentOfCentsRoundedHalfUp(cents: number, percent: number): number {
  return Math.floor((cents * percent + 50) / 100);
}
