import { describe, expect, it } from "@jest/globals";
import type { Attendee, Extras, FamilyGroup, Selection } from "./types";
import { validateBooker, validateSelection } from "./validation";

const noExtras: Extras = { sticksPairs: 0, dinners: [], workshops: [] };

function selection(parts: Partial<Selection>): Selection {
  return { attendees: [], familyGroups: [], extras: noExtras, ...parts };
}

function dayAdult(id: string, dates: Attendee["firstVisitDate"][]): Attendee {
  return {
    id,
    name: `Adult ${id}`,
    firstVisitDate: dates[0] ?? "2026-11-10",
    ageAtFirstVisit: 30,
    admission: { kind: "day", category: "adult", dates },
  };
}

function familyMember(id: string, age: number, familyId = "f1"): Attendee {
  return {
    id,
    name: `Member ${id.replace(/\d/g, "")}`,
    firstVisitDate: "2026-11-10",
    ageAtFirstVisit: age,
    admission: { kind: "family", familyId },
  };
}

const familyGroup: FamilyGroup = {
  id: "f1",
  dates: ["2026-11-10", "2026-11-11"],
};

const fullFamily = [
  familyMember("p1", 40),
  familyMember("p2", 38),
  familyMember("k1", 9),
  familyMember("k2", 6),
];

function paths(s: Selection): string[] {
  return validateSelection(s).map((issue) => issue.path);
}

describe("validateSelection", () => {
  it("accepts a valid mixed booking", () => {
    const s = selection({
      attendees: [
        ...fullFamily,
        dayAdult("a", ["2026-11-11", "2026-11-13"]),
        {
          id: "u",
          name: "Toddler",
          firstVisitDate: "2026-11-10",
          ageAtFirstVisit: 3,
          admission: { kind: "free", dates: ["2026-11-10"] },
        },
      ],
      familyGroups: [familyGroup],
      extras: {
        sticksPairs: 10,
        dinners: [
          { attendeeId: "u", date: "2026-11-10" },
          { attendeeId: "p1", date: "2026-11-11" },
        ],
        workshops: [
          { attendeeId: "a", date: "2026-11-11" },
          { attendeeId: "a", date: "2026-11-13" },
        ],
      },
    });
    expect(validateSelection(s)).toEqual([]);
  });

  describe("attendees", () => {
    it("requires at least one attendee, even when extras are chosen", () => {
      const s = selection({ extras: { ...noExtras, sticksPairs: 2 } });
      expect(validateSelection(s)).toEqual([
        {
          path: "attendees",
          message: "Add at least one person who is coming.",
        },
      ]);
    });

    it("requires a name", () => {
      const s = selection({
        attendees: [{ ...dayAdult("a", ["2026-11-10"]), name: "  " }],
      });
      expect(validateSelection(s)).toEqual([
        { path: "attendees.0.name", message: "Enter a name." },
        {
          path: "attendees.0.name",
          message:
            "Enter a valid name using letters, spaces, hyphens or apostrophes.",
        },
      ]);
    });

    it("rejects a name that contains a number", () => {
      const s = selection({
        attendees: [{ ...dayAdult("a", ["2026-11-10"]), name: "Asha 2" }],
      });
      expect(validateSelection(s)).toEqual([
        {
          path: "attendees.0.name",
          message:
            "Enter a valid name using letters, spaces, hyphens or apostrophes.",
        },
      ]);
    });

    it.each([-1, 4.5, 151])("rejects age %p", (age) => {
      const s = selection({
        attendees: [{ ...dayAdult("a", ["2026-11-10"]), ageAtFirstVisit: age }],
      });
      expect(paths(s)).toEqual(["attendees.0.ageAtFirstVisit"]);
    });

    it("rejects duplicate attendee IDs", () => {
      const s = selection({
        attendees: [
          dayAdult("a", ["2026-11-10"]),
          dayAdult("a", ["2026-11-11"]),
        ],
      });
      expect(paths(s)).toEqual(["attendees.1.id"]);
    });

    it("needs an adult ticket for someone who is 12 on their first visit", () => {
      const s = selection({
        attendees: [
          {
            id: "a",
            name: "Asha",
            firstVisitDate: "2026-11-13",
            ageAtFirstVisit: 12,
            admission: {
              kind: "day",
              category: "child",
              dates: ["2026-11-13"],
            },
          },
        ],
      });
      expect(validateSelection(s)).toEqual([
        {
          path: "attendees.0.admission.category",
          message: "Age 12 on their first visit needs an adult ticket.",
        },
      ]);
    });

    it("rejects an adult All-Day Pass for a child", () => {
      const s = selection({
        attendees: [
          {
            id: "c",
            name: "Child",
            firstVisitDate: "2026-11-10",
            ageAtFirstVisit: 8,
            admission: { kind: "all_days", category: "adult" },
          },
        ],
      });
      expect(paths(s)).toEqual(["attendees.0.admission.category"]);
    });

    it("rejects a ticket for an under-five", () => {
      const s = selection({
        attendees: [{ ...dayAdult("u", ["2026-11-10"]), ageAtFirstVisit: 4 }],
      });
      expect(paths(s)).toEqual(["attendees.0.admission"]);
    });

    it("rejects free entry for someone aged 5 or over", () => {
      const s = selection({
        attendees: [
          {
            id: "c",
            name: "Child",
            firstVisitDate: "2026-11-10",
            ageAtFirstVisit: 5,
            admission: { kind: "free", dates: ["2026-11-10"] },
          },
        ],
      });
      expect(validateSelection(s)).toEqual([
        {
          path: "attendees.0.admission",
          message: "Free entry is only for children under 5.",
        },
      ]);
    });

    it("requires at least one date", () => {
      const s = selection({ attendees: [dayAdult("a", [])] });
      expect(paths(s)).toEqual(["attendees.0.admission.dates"]);
    });

    it("rejects the same date chosen twice", () => {
      const s = selection({
        attendees: [dayAdult("a", ["2026-11-10", "2026-11-10"])],
      });
      expect(paths(s)).toEqual(["attendees.0.admission.dates"]);
    });

    it("requires the first visit to be the earliest selected date", () => {
      const s = selection({
        attendees: [
          {
            ...dayAdult("a", ["2026-11-12", "2026-11-11"]),
            firstVisitDate: "2026-11-12",
          },
        ],
      });
      expect(validateSelection(s)).toEqual([
        {
          path: "attendees.0.firstVisitDate",
          message: "The first visit must be their earliest date, 2026-11-11.",
        },
      ]);
    });

    it("lets an All-Day Pass holder first visit on any festival date", () => {
      const s = selection({
        attendees: [
          {
            id: "a",
            name: "Late arrival",
            firstVisitDate: "2026-11-13",
            ageAtFirstVisit: 15,
            admission: { kind: "all_days", category: "adult" },
          },
        ],
      });
      expect(validateSelection(s)).toEqual([]);
    });
  });

  describe("Family Pass groups", () => {
    it("accepts exactly 2 adults and 2 children", () => {
      const s = selection({
        attendees: fullFamily,
        familyGroups: [familyGroup],
      });
      expect(validateSelection(s)).toEqual([]);
    });

    it("rejects 3 adults and 1 child", () => {
      const s = selection({
        attendees: [
          familyMember("p1", 40),
          familyMember("p2", 38),
          familyMember("p3", 12),
          familyMember("k1", 11),
        ],
        familyGroups: [familyGroup],
      });
      expect(validateSelection(s)).toEqual([
        {
          path: "familyGroups.0",
          message:
            "A Family Pass needs exactly 2 adults (12+) and 2 children (5–11). This group has 3 adults and 1 child.",
        },
      ]);
    });

    it("rejects a group with no members", () => {
      const s = selection({
        attendees: [dayAdult("a", ["2026-11-10"])],
        familyGroups: [familyGroup],
      });
      expect(paths(s)).toEqual(["familyGroups.0"]);
    });

    it("does not let an under-five fill a child place", () => {
      const s = selection({
        attendees: [
          familyMember("p1", 40),
          familyMember("p2", 38),
          familyMember("k1", 9),
          familyMember("u", 3),
        ],
        familyGroups: [familyGroup],
      });
      expect(paths(s)).toEqual(["attendees.3.admission", "familyGroups.0"]);
    });

    it("requires a group that exists", () => {
      const s = selection({
        attendees: [familyMember("p1", 40, "missing")],
      });
      expect(paths(s)).toEqual(["attendees.0.admission.familyId"]);
    });

    it("requires members' first visit to be the group's earliest date", () => {
      const late = {
        ...familyMember("k2", 6),
        firstVisitDate: "2026-11-11",
      } as const;
      const s = selection({
        attendees: [...fullFamily.slice(0, 3), late],
        familyGroups: [familyGroup],
      });
      expect(paths(s)).toEqual(["attendees.3.firstVisitDate"]);
    });

    it("requires the group to have dates", () => {
      const s = selection({
        attendees: fullFamily,
        familyGroups: [{ id: "f1", dates: [] }],
      });
      expect(paths(s)).toEqual(["familyGroups.0.dates"]);
    });
  });

  describe("extras", () => {
    it.each([-1, 1.5, 11])("rejects %p pairs of sticks", (sticksPairs) => {
      const s = selection({
        attendees: [dayAdult("a", ["2026-11-10"])],
        extras: { ...noExtras, sticksPairs },
      });
      expect(validateSelection(s)).toEqual([
        {
          path: "extras.sticksPairs",
          message: "Choose between 0 and 10 pairs.",
        },
      ]);
    });

    it("rejects a dinner on a date the attendee isn't attending", () => {
      const s = selection({
        attendees: [dayAdult("a", ["2026-11-10"])],
        extras: {
          ...noExtras,
          dinners: [{ attendeeId: "a", date: "2026-11-12" }],
        },
      });
      expect(validateSelection(s)).toEqual([
        {
          path: "extras.dinners.0.date",
          message: "Adult a isn't attending on 2026-11-12.",
        },
      ]);
    });

    it("rejects a second dinner for the same person and date", () => {
      const dinner = { attendeeId: "a", date: "2026-11-10" } as const;
      const s = selection({
        attendees: [dayAdult("a", ["2026-11-10"])],
        extras: { ...noExtras, dinners: [dinner, dinner] },
      });
      expect(paths(s)).toEqual(["extras.dinners.1"]);
    });

    it("rejects an extra for someone not in the booking", () => {
      const s = selection({
        attendees: [dayAdult("a", ["2026-11-11"])],
        extras: {
          ...noExtras,
          workshops: [{ attendeeId: "ghost", date: "2026-11-11" }],
        },
      });
      expect(paths(s)).toEqual(["extras.workshops.0.attendeeId"]);
    });

    it("rejects a second place in the same workshop session", () => {
      const session = { attendeeId: "a", date: "2026-11-11" } as const;
      const s = selection({
        attendees: [dayAdult("a", ["2026-11-11"])],
        extras: { ...noExtras, workshops: [session, session] },
      });
      expect(paths(s)).toEqual(["extras.workshops.1"]);
    });

    it("rejects an All-Day Pass holder's workshop before their first visit", () => {
      const s = selection({
        attendees: [
          {
            id: "a",
            name: "Late arrival",
            firstVisitDate: "2026-11-12",
            ageAtFirstVisit: 30,
            admission: { kind: "all_days", category: "adult" },
          },
        ],
        extras: {
          ...noExtras,
          workshops: [
            { attendeeId: "a", date: "2026-11-11" },
            { attendeeId: "a", date: "2026-11-13" },
          ],
        },
      });
      expect(paths(s)).toEqual(["extras.workshops.0.date"]);
    });

    it("allows Family Pass members extras on the group's dates only", () => {
      const s = selection({
        attendees: fullFamily,
        familyGroups: [familyGroup],
        extras: {
          ...noExtras,
          dinners: [
            { attendeeId: "k1", date: "2026-11-11" },
            { attendeeId: "k1", date: "2026-11-12" },
          ],
        },
      });
      expect(paths(s)).toEqual(["extras.dinners.1.date"]);
    });
  });
});

describe("validateBooker", () => {
  const booker = { name: "Priya", email: "priya@example.com", age: 35 };

  it("accepts a valid booker with or without a phone", () => {
    expect(validateBooker(booker)).toEqual([]);
    expect(validateBooker({ ...booker, phone: "+1 (469) 555-0100" })).toEqual(
      [],
    );
  });

  it.each([
    [{ name: " " }, "name"],
    [{ email: "priya@" }, "email"],
    [{ email: "priya example.com" }, "email"],
    [{ age: 17 }, "age"],
    [{ age: 18.5 }, "age"],
    [{ age: 151 }, "age"],
    [{ phone: "call me" }, "phone"],
  ])("rejects %p at %s", (change, path) => {
    expect(
      validateBooker({ ...booker, ...change }).map((issue) => issue.path),
    ).toEqual([path]);
  });

  it("explains the minimum booker age", () => {
    expect(validateBooker({ ...booker, age: 17 })).toEqual([
      { path: "age", message: "The person booking must be 18 or older." },
    ]);
  });
});
