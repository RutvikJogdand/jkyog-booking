import type { ProductId, Selection } from "./types";

// Units are both what a booking is charged for and what checkout deducts from stock.
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
