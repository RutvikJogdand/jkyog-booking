import type { PriceList } from "@/domain/booking/pricing";
import type { PromoTable } from "@/domain/booking/promotions";
import { FESTIVAL_DATES } from "@/domain/booking/types";

// Trusted event, price and promo data from the assignment (PRD sections 1, 3 and 5).
// The server prices every request from this file; browser-supplied prices are never used.

export const EVENT = {
  name: "Sharad Utsav 2026",
  venue: "Radha Krishna Temple, Allen, Texas",
  dates: FESTIVAL_DATES,
  currency: "USD",
} as const;

export const PRICES: PriceList = {
  day_adult: { name: "Adult Day Pass", unitPriceCents: 1500 },
  day_child: { name: "Child Day Pass", unitPriceCents: 800 },
  all_days_adult: { name: "Adult All-Day Pass", unitPriceCents: 6000 },
  all_days_child: { name: "Child All-Day Pass", unitPriceCents: 3000 },
  family: { name: "Family Pass", unitPriceCents: 4000 },
  dandiya_sticks: { name: "Dandiya Sticks", unitPriceCents: 500 },
  dinner_plate: { name: "Dinner Plate", unitPriceCents: 1200 },
  garba_workshop: { name: "Garba Workshop", unitPriceCents: 2000 },
};

export const PROMOS: PromoTable = {
  SEVA10: { kind: "percent_off_subtotal", percent: 10 },
  FLAT20: { kind: "flat_off", amountCents: 2000, minimumSubtotalCents: 2000 },
  KIDSFREE: {
    kind: "products_free",
    productIds: ["day_child", "all_days_child"],
  },
  EXPIRED5: { kind: "expired" },
  MAXEDOUT: { kind: "usage_limit_reached" },
};
