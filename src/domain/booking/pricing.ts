import {
  PRODUCT_IDS,
  type ProductId,
  type QuoteLine,
  type Selection,
} from "./types";

export interface ProductPrice {
  name: string;
  unitPriceCents: number;
}

export type PriceList = Readonly<Record<ProductId, ProductPrice>>;

export interface PricedSelection {
  lines: readonly QuoteLine[];
  subtotalCents: number;
}

// Expects a selection that has already passed validation.
export function countUnits(selection: Selection): Record<ProductId, number> {
  const units: Record<ProductId, number> = {
    day_adult: 0,
    day_child: 0,
    all_days_adult: 0,
    all_days_child: 0,
    family: 0,
    dandiya_sticks: selection.extras.sticksPairs,
    dinner_plate: selection.extras.dinners.length,
    garba_workshop: selection.extras.workshops.length,
  };

  for (const { admission } of selection.attendees) {
    if (admission.kind === "day") {
      units[`day_${admission.category}`] += admission.dates.length;
    } else if (admission.kind === "all_days") {
      units[`all_days_${admission.category}`] += 1;
    }
  }

  for (const group of selection.familyGroups) {
    units.family += group.dates.length;
  }

  return units;
}

export function priceSelection(
  selection: Selection,
  prices: PriceList,
): PricedSelection {
  const units = countUnits(selection);
  const lines: QuoteLine[] = [];

  for (const productId of PRODUCT_IDS) {
    const quantity = units[productId];
    if (quantity === 0) {
      continue;
    }
    const { name, unitPriceCents } = prices[productId];
    lines.push({
      productId,
      description: name,
      quantity,
      unitPriceCents,
      amountCents: quantity * unitPriceCents,
    });
  }

  const subtotalCents = lines.reduce((sum, line) => sum + line.amountCents, 0);
  return { lines, subtotalCents };
}
