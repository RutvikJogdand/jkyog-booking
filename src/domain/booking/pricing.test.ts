import { describe, expect, it } from "@jest/globals";
import { priceSelection, type PriceList } from "./pricing";
import type { Attendee, Extras, Selection } from "./types";

// Prices from PRD section 3. The trusted catalog lives in src/server/catalog.ts.
const prices: PriceList = {
  day_adult: { name: "Adult Day Pass", unitPriceCents: 1500 },
  day_child: { name: "Child Day Pass", unitPriceCents: 800 },
  all_days_adult: { name: "Adult All-Day Pass", unitPriceCents: 6000 },
  all_days_child: { name: "Child All-Day Pass", unitPriceCents: 3000 },
  family: { name: "Family Pass", unitPriceCents: 4000 },
  dandiya_sticks: { name: "Dandiya Sticks (pair)", unitPriceCents: 500 },
  dinner_plate: { name: "Dinner Plate", unitPriceCents: 1200 },
  garba_workshop: { name: "Garba Workshop", unitPriceCents: 2000 },
};

const noExtras: Extras = { sticksPairs: 0, dinners: [], workshops: [] };

function selection(parts: Partial<Selection>): Selection {
  return { attendees: [], familyGroups: [], extras: noExtras, ...parts };
}

function attendee(
  id: string,
  ageAtFirstVisit: number,
  admission: Attendee["admission"],
): Attendee {
  return {
    id,
    name: `Person ${id}`,
    firstVisitDate: "2026-11-10",
    ageAtFirstVisit,
    admission,
  };
}

describe("priceSelection", () => {
  it("returns no lines and a zero subtotal for an empty selection", () => {
    expect(priceSelection(selection({}), prices)).toEqual({
      lines: [],
      subtotalCents: 0,
    });
  });

  it("charges an adult Day Pass once per selected date", () => {
    const result = priceSelection(
      selection({
        attendees: [
          attendee("a", 30, {
            kind: "day",
            category: "adult",
            dates: ["2026-11-10", "2026-11-11", "2026-11-12"],
          }),
        ],
      }),
      prices,
    );

    expect(result.lines).toEqual([
      {
        productId: "day_adult",
        description: "Adult Day Pass",
        quantity: 3,
        unitPriceCents: 1500,
        amountCents: 4500,
      },
    ]);
    expect(result.subtotalCents).toBe(4500);
  });

  it("charges an All-Day Pass once, whatever day the holder first arrives", () => {
    const result = priceSelection(
      selection({
        attendees: [
          {
            ...attendee("c", 8, { kind: "all_days", category: "child" }),
            firstVisitDate: "2026-11-12",
          },
        ],
      }),
      prices,
    );

    expect(result.lines).toEqual([
      expect.objectContaining({ productId: "all_days_child", quantity: 1 }),
    ]);
    expect(result.subtotalCents).toBe(3000);
  });

  it("charges a Family Pass per group per date and no individual tickets for its members", () => {
    const family = { kind: "family", familyId: "f1" } as const;
    const result = priceSelection(
      selection({
        attendees: [
          attendee("p1", 40, family),
          attendee("p2", 38, family),
          attendee("k1", 9, family),
          attendee("k2", 6, family),
        ],
        familyGroups: [{ id: "f1", dates: ["2026-11-10", "2026-11-11"] }],
      }),
      prices,
    );

    expect(result.lines).toEqual([
      expect.objectContaining({
        productId: "family",
        quantity: 2,
        amountCents: 8000,
      }),
    ]);
    expect(result.subtotalCents).toBe(8000);
  });

  it("gives under-fives free entry but charges their dinner normally", () => {
    const result = priceSelection(
      selection({
        attendees: [attendee("u", 3, { kind: "free", dates: ["2026-11-12"] })],
        extras: {
          ...noExtras,
          dinners: [{ attendeeId: "u", date: "2026-11-12" }],
        },
      }),
      prices,
    );

    expect(result.lines).toEqual([
      expect.objectContaining({
        productId: "dinner_plate",
        quantity: 1,
        amountCents: 1200,
      }),
    ]);
    expect(result.subtotalCents).toBe(1200);
  });

  it("charges each workshop session separately", () => {
    const result = priceSelection(
      selection({
        attendees: [
          attendee("a", 25, {
            kind: "day",
            category: "adult",
            dates: ["2026-11-11", "2026-11-13"],
          }),
        ],
        extras: {
          ...noExtras,
          workshops: [
            { attendeeId: "a", date: "2026-11-11" },
            { attendeeId: "a", date: "2026-11-13" },
          ],
        },
      }),
      prices,
    );

    expect(result.lines).toContainEqual(
      expect.objectContaining({
        productId: "garba_workshop",
        quantity: 2,
        amountCents: 4000,
      }),
    );
    expect(result.subtotalCents).toBe(3000 + 4000);
  });

  it("prices the PRD example of one adult Day Pass plus one pair of sticks at 2000 cents", () => {
    const result = priceSelection(
      selection({
        attendees: [
          attendee("a", 30, {
            kind: "day",
            category: "adult",
            dates: ["2026-11-10"],
          }),
        ],
        extras: { ...noExtras, sticksPairs: 1 },
      }),
      prices,
    );

    expect(result.subtotalCents).toBe(2000);
  });

  it("lists lines in catalog order and adds them into the subtotal", () => {
    const result = priceSelection(
      selection({
        attendees: [
          attendee("c", 7, {
            kind: "day",
            category: "child",
            dates: ["2026-11-10", "2026-11-11"],
          }),
          attendee("a", 35, {
            kind: "day",
            category: "adult",
            dates: ["2026-11-10"],
          }),
        ],
        extras: {
          sticksPairs: 10,
          dinners: [
            { attendeeId: "a", date: "2026-11-10" },
            { attendeeId: "c", date: "2026-11-10" },
          ],
          workshops: [],
        },
      }),
      prices,
    );

    expect(result.lines.map((line) => line.productId)).toEqual([
      "day_adult",
      "day_child",
      "dandiya_sticks",
      "dinner_plate",
    ]);
    expect(result.subtotalCents).toBe(1500 + 2 * 800 + 10 * 500 + 2 * 1200);
  });
});
