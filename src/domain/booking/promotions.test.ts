import { describe, expect, it } from "@jest/globals";
import type { PricedSelection } from "./pricing";
import { applyPromotion, type PromoTable } from "./promotions";
import type { ProductId, QuoteLine } from "./types";

// Codes and rules from PRD section 5. The trusted table lives in src/server/catalog.ts.
const promos: PromoTable = {
  SEVA10: { kind: "percent_off_subtotal", percent: 10 },
  FLAT20: { kind: "flat_off", amountCents: 2000, minimumSubtotalCents: 2000 },
  KIDSFREE: {
    kind: "products_free",
    productIds: ["day_child", "all_days_child"],
  },
  EXPIRED5: { kind: "expired" },
  MAXEDOUT: { kind: "usage_limit_reached" },
};

function line(
  productId: ProductId,
  quantity: number,
  unitPriceCents: number,
): QuoteLine {
  return {
    productId,
    description: productId,
    quantity,
    unitPriceCents,
    amountCents: quantity * unitPriceCents,
  };
}

function priced(...lines: QuoteLine[]): PricedSelection {
  return {
    lines,
    subtotalCents: lines.reduce((sum, l) => sum + l.amountCents, 0),
  };
}

const adultDay = line("day_adult", 1, 1500);
const sticks = line("dandiya_sticks", 1, 500);

describe("applyPromotion", () => {
  it.each([undefined, ""])(
    "applies nothing when no code is given (%p)",
    (code) => {
      expect(applyPromotion(code, priced(adultDay), promos)).toEqual({
        status: "none",
        discountCents: 0,
      });
    },
  );

  describe("SEVA10", () => {
    it("takes 10% off the whole subtotal, including extras", () => {
      expect(
        applyPromotion("SEVA10", priced(adultDay, sticks), promos),
      ).toEqual({
        status: "applied",
        code: "SEVA10",
        discountCents: 200,
      });
    });

    it("rounds half a cent up", () => {
      expect(
        applyPromotion("SEVA10", priced(line("day_adult", 1, 1505)), promos)
          .discountCents,
      ).toBe(151);
    });

    it("rounds less than half a cent down", () => {
      expect(
        applyPromotion("SEVA10", priced(line("day_adult", 1, 1504)), promos)
          .discountCents,
      ).toBe(150);
    });
  });

  describe("FLAT20", () => {
    it("is rejected below the $20 minimum: a $15 ticket", () => {
      expect(applyPromotion("FLAT20", priced(adultDay), promos)).toEqual({
        status: "rejected",
        code: "FLAT20",
        discountCents: 0,
        reason: "below_minimum",
        minimumSubtotalCents: 2000,
      });
    });

    it("applies at exactly $20 and brings a $15 ticket plus $5 sticks to $0", () => {
      const result = applyPromotion("FLAT20", priced(adultDay, sticks), promos);
      expect(result).toEqual({
        status: "applied",
        code: "FLAT20",
        discountCents: 2000,
      });
    });

    it("takes exactly $20 off a larger subtotal", () => {
      expect(
        applyPromotion("FLAT20", priced(line("day_adult", 3, 1500)), promos)
          .discountCents,
      ).toBe(2000);
    });
  });

  describe("KIDSFREE", () => {
    it("makes child Day and All-Day tickets free", () => {
      const result = applyPromotion(
        "KIDSFREE",
        priced(line("day_child", 2, 800), line("all_days_child", 1, 3000)),
        promos,
      );
      expect(result.discountCents).toBe(1600 + 3000);
    });

    it("leaves the Family Pass, adult tickets and extras at full price", () => {
      const result = applyPromotion(
        "KIDSFREE",
        priced(
          line("family", 1, 4000),
          adultDay,
          sticks,
          line("dinner_plate", 1, 1200),
          line("day_child", 1, 800),
        ),
        promos,
      );
      expect(result.discountCents).toBe(800);
    });

    it("is rejected on a $40 Family Pass alone, because there are no child tickets", () => {
      expect(
        applyPromotion("KIDSFREE", priced(line("family", 1, 4000)), promos),
      ).toEqual({
        status: "rejected",
        code: "KIDSFREE",
        discountCents: 0,
        reason: "no_eligible_items",
        productIds: ["day_child", "all_days_child"],
      });
    });

    it("is rejected when the booking has only adult tickets and extras", () => {
      expect(
        applyPromotion("KIDSFREE", priced(adultDay, sticks), promos).status,
      ).toBe("rejected");
    });
  });

  it.each([
    ["EXPIRED5", "expired"],
    ["MAXEDOUT", "usage_limit_reached"],
    ["WELCOME", "not_recognised"],
    ["constructor", "not_recognised"],
    ["toString", "not_recognised"],
    ["__proto__", "not_recognised"],
  ])("rejects %p as %s and applies no discount", (code, reason) => {
    expect(applyPromotion(code, priced(adultDay, sticks), promos)).toEqual({
      status: "rejected",
      code,
      discountCents: 0,
      reason,
    });
  });

  it.each(["seva10", "Seva10", " SEVA10", "SEVA10 ", "   "])(
    "requires an exact match, so %p is not recognised",
    (code) => {
      expect(applyPromotion(code, priced(adultDay), promos)).toEqual({
        status: "rejected",
        code,
        discountCents: 0,
        reason: "not_recognised",
      });
    },
  );
});
