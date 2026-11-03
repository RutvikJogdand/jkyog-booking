import { describe, expect, it } from "@jest/globals";
import {
  bookingReducer,
  initialDraft,
  needsAgeCheck,
  toSelection,
  type Action,
  type Draft,
} from "./booking-reducer";

function run(...actions: Action[]): Draft {
  return actions.reduce(bookingReducer, initialDraft);
}

const asha = (
  changes: Extract<Action, { type: "attendeeChanged" }>["changes"],
) => ({ type: "attendeeChanged", id: "a", changes }) as const;

describe("bookingReducer", () => {
  it("removes a dinner and explains why when its date is unticked", () => {
    const draft = run(
      { type: "attendeeAdded", id: "a" },
      asha({ name: "Asha", dates: ["2026-11-10", "2026-11-12"] }),
      { type: "dinnerToggled", pick: { attendeeId: "a", date: "2026-11-12" } },
      asha({ dates: ["2026-11-10"] }),
    );

    expect(draft.dinners).toEqual([]);
    expect(draft.notices).toEqual([
      "Removed Asha's Dinner Plate on Thu 12 Nov because they're no longer attending that day.",
    ]);
  });

  it("removes a removed person's workshop place and explains why", () => {
    const draft = run(
      { type: "attendeeAdded", id: "a" },
      asha({ name: "Asha", dates: ["2026-11-11"] }),
      {
        type: "workshopToggled",
        pick: { attendeeId: "a", date: "2026-11-11" },
      },
      { type: "attendeeRemoved", id: "a" },
    );

    expect(draft.workshops).toEqual([]);
    expect(draft.notices).toEqual([
      "Removed Asha's Garba Workshop on Wed 11 Nov because they were removed from the booking.",
    ]);
  });

  it("asks for the age to be checked again when the first day changes", () => {
    let draft = run(
      { type: "attendeeAdded", id: "a" },
      asha({ dates: ["2026-11-12"] }),
      { type: "attendeeAgeChanged", id: "a", ageText: "11" },
    );
    expect(needsAgeCheck(draft.attendees[0]!, draft.familyGroups)).toBe(false);

    draft = bookingReducer(
      draft,
      asha({ dates: ["2026-11-10", "2026-11-12"] }),
    );
    expect(needsAgeCheck(draft.attendees[0]!, draft.familyGroups)).toBe(true);

    draft = bookingReducer(draft, { type: "attendeeAgeConfirmed", id: "a" });
    expect(needsAgeCheck(draft.attendees[0]!, draft.familyGroups)).toBe(false);
  });
});

describe("toSelection", () => {
  it("is null with no attendees, or while an age is empty", () => {
    expect(toSelection(initialDraft)).toBeNull();
    const draft = run(
      { type: "attendeeAdded", id: "a" },
      asha({ name: "Asha", dates: ["2026-11-10"] }),
    );
    expect(toSelection(draft)).toBeNull();
  });

  it("turns an under-five on chosen days into free entry", () => {
    const draft = run(
      { type: "attendeeAdded", id: "a" },
      asha({ name: "Tiny", dates: ["2026-11-11", "2026-11-10"] }),
      { type: "attendeeAgeChanged", id: "a", ageText: "3" },
    );
    expect(toSelection(draft)?.attendees[0]).toEqual({
      id: "a",
      name: "Tiny",
      firstVisitDate: "2026-11-10",
      ageAtFirstVisit: 3,
      admission: { kind: "free", dates: ["2026-11-10", "2026-11-11"] },
    });
  });

  it("uses the age category for a Day Pass", () => {
    const draft = run(
      { type: "attendeeAdded", id: "a" },
      asha({ name: "Kid", dates: ["2026-11-13"] }),
      { type: "attendeeAgeChanged", id: "a", ageText: "12" },
    );
    expect(toSelection(draft)?.attendees[0]?.admission).toEqual({
      kind: "day",
      category: "adult",
      dates: ["2026-11-13"],
    });
  });
});
