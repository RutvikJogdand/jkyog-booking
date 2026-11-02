import { describe, expect, it } from "@jest/globals";
import { countUnits } from "./inventory";
import type { Attendee, Selection } from "./types";

function attendee(id: string, admission: Attendee["admission"]): Attendee {
  return {
    id,
    name: `Person ${id}`,
    firstVisitDate: "2026-11-11",
    ageAtFirstVisit: 30,
    admission,
  };
}

const emptySelection: Selection = {
  attendees: [],
  familyGroups: [],
  extras: { sticksPairs: 0, dinners: [], workshops: [] },
};

describe("countUnits", () => {
  it("needs no stock for an empty selection", () => {
    expect(Object.values(countUnits(emptySelection))).toEqual(Array(8).fill(0));
  });

  it("uses one Day Pass unit per person per date", () => {
    const units = countUnits({
      ...emptySelection,
      attendees: [
        attendee("a", {
          kind: "day",
          category: "adult",
          dates: ["2026-11-11", "2026-11-12", "2026-11-13"],
        }),
      ],
    });
    expect(units.day_adult).toBe(3);
  });

  it("uses one All-Day Pass unit per person", () => {
    const units = countUnits({
      ...emptySelection,
      attendees: [attendee("c", { kind: "all_days", category: "child" })],
    });
    expect(units.all_days_child).toBe(1);
  });

  it("uses one Family Pass unit per group per date and no individual ticket stock", () => {
    const family = { kind: "family", familyId: "f1" } as const;
    const units = countUnits({
      ...emptySelection,
      attendees: ["p1", "p2", "k1", "k2"].map((id) => attendee(id, family)),
      familyGroups: [
        { id: "f1", dates: ["2026-11-11", "2026-11-12", "2026-11-14"] },
      ],
    });
    expect(units.family).toBe(3);
    expect(units.day_adult + units.day_child).toBe(0);
    expect(units.all_days_adult + units.all_days_child).toBe(0);
  });

  it("uses no ticket stock for free under-five entry", () => {
    const units = countUnits({
      ...emptySelection,
      attendees: [attendee("u", { kind: "free", dates: ["2026-11-11"] })],
    });
    expect(Object.values(units).every((count) => count === 0)).toBe(true);
  });

  it("draws both workshop sessions from the one workshop stock", () => {
    const units = countUnits({
      ...emptySelection,
      attendees: [
        attendee("a", {
          kind: "day",
          category: "adult",
          dates: ["2026-11-11", "2026-11-13"],
        }),
      ],
      extras: {
        sticksPairs: 0,
        dinners: [],
        workshops: [
          { attendeeId: "a", date: "2026-11-11" },
          { attendeeId: "a", date: "2026-11-13" },
        ],
      },
    });
    expect(units.garba_workshop).toBe(2);
  });

  it("counts sticks pairs and one unit per dinner selection", () => {
    const units = countUnits({
      ...emptySelection,
      extras: {
        sticksPairs: 4,
        dinners: [
          { attendeeId: "a", date: "2026-11-11" },
          { attendeeId: "b", date: "2026-11-11" },
        ],
        workshops: [],
      },
    });
    expect(units.dandiya_sticks).toBe(4);
    expect(units.dinner_plate).toBe(2);
  });
});
