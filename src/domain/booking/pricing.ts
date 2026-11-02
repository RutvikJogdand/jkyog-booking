import { countUnits } from "./inventory";
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
