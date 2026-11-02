// Validated booking data. Form drafts and API JSON become these types only after their checks pass.

export const FESTIVAL_DATES = [
  "2026-11-10",
  "2026-11-11",
  "2026-11-12",
  "2026-11-13",
  "2026-11-14",
] as const;
export type FestivalDate = (typeof FESTIVAL_DATES)[number];

export const WORKSHOP_DATES = ["2026-11-11", "2026-11-13"] as const;
export type WorkshopDate = (typeof WORKSHOP_DATES)[number];

export type AgeCategory = "adult" | "child" | "under_five";
export type TicketCategory = Exclude<AgeCategory, "under_five">;

export const PRODUCT_IDS = [
  "day_adult",
  "day_child",
  "all_days_adult",
  "all_days_child",
  "family",
  "dandiya_sticks",
  "dinner_plate",
  "garba_workshop",
] as const;
export type ProductId = (typeof PRODUCT_IDS)[number];

export type Admission =
  | {
      kind: "day";
      category: TicketCategory;
      dates: readonly FestivalDate[];
    }
  | { kind: "all_days"; category: TicketCategory }
  | { kind: "family"; familyId: string }
  | { kind: "free"; dates: readonly FestivalDate[] };

export type AdmissionKind = Admission["kind"];

export interface Attendee {
  id: string;
  name: string;
  firstVisitDate: FestivalDate;
  ageAtFirstVisit: number;
  admission: Admission;
}

export interface FamilyGroup {
  id: string;
  dates: readonly FestivalDate[];
}

export interface DinnerSelection {
  attendeeId: string;
  date: FestivalDate;
}

export interface WorkshopSelection {
  attendeeId: string;
  date: WorkshopDate;
}

export interface Extras {
  sticksPairs: number;
  dinners: readonly DinnerSelection[];
  workshops: readonly WorkshopSelection[];
}

export interface Selection {
  attendees: readonly Attendee[];
  familyGroups: readonly FamilyGroup[];
  extras: Extras;
  promoCode?: string;
}

export interface QuoteLine {
  productId: ProductId;
  description: string;
  quantity: number;
  unitPriceCents: number;
  amountCents: number;
}

export interface Quote {
  lines: readonly QuoteLine[];
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  currency: "USD";
}
