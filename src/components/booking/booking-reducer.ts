import { categoryForAge, parseAgeInput } from "@/domain/booking/age";
import {
  FESTIVAL_DATES,
  WORKSHOP_DATES,
  type Admission,
  type Booker,
  type FestivalDate,
  type Selection,
} from "@/domain/booking/types";
import { DATE_LABELS } from "./format";

// Form drafts keep what people typed (e.g. ageText) separate from validated data:
// an empty age field must never become 0.

export type AttendMode = "days" | "all_days" | "family";

export interface DraftAttendee {
  id: string;
  name: string;
  mode: AttendMode;
  dates: FestivalDate[];
  allDaysFirstVisit: FestivalDate | null;
  familyId: string | null;
  ageText: string;
  ageCheckedFor: FestivalDate | null;
}

export interface DraftFamilyGroup {
  id: string;
  dates: FestivalDate[];
}

export interface DatedPick {
  attendeeId: string;
  date: FestivalDate;
}

export interface DraftBooker {
  name: string;
  email: string;
  ageText: string;
  phone: string;
}

export interface Draft {
  attendees: DraftAttendee[];
  familyGroups: DraftFamilyGroup[];
  sticksPairs: number;
  dinners: DatedPick[];
  workshops: DatedPick[];
  booker: DraftBooker;
  promoCode: string | null;
  notices: string[];
}

export const initialDraft: Draft = {
  attendees: [],
  familyGroups: [],
  sticksPairs: 0,
  dinners: [],
  workshops: [],
  booker: { name: "", email: "", ageText: "", phone: "" },
  promoCode: null,
  notices: [],
};

type AttendeeChanges = Partial<
  Pick<
    DraftAttendee,
    "name" | "mode" | "dates" | "allDaysFirstVisit" | "familyId"
  >
>;

export type Action =
  | { type: "attendeeAdded"; id: string }
  | { type: "attendeeRemoved"; id: string }
  | { type: "attendeeChanged"; id: string; changes: AttendeeChanges }
  | { type: "attendeeAgeChanged"; id: string; ageText: string }
  | { type: "attendeeAgeConfirmed"; id: string }
  | { type: "familyGroupAdded"; id: string }
  | { type: "familyGroupRemoved"; id: string }
  | { type: "familyGroupDatesChanged"; id: string; dates: FestivalDate[] }
  | { type: "sticksChanged"; pairs: number }
  | { type: "dinnerToggled"; pick: DatedPick }
  | { type: "workshopToggled"; pick: DatedPick }
  | { type: "bookerChanged"; changes: Partial<DraftBooker> }
  | { type: "promoApplied"; code: string }
  | { type: "promoRemoved" }
  | { type: "noticeDismissed"; index: number };

export function firstVisit(
  attendee: DraftAttendee,
  groups: readonly DraftFamilyGroup[],
): FestivalDate | null {
  if (attendee.mode === "all_days") return attendee.allDaysFirstVisit;
  const dates =
    attendee.mode === "days"
      ? attendee.dates
      : (groups.find((g) => g.id === attendee.familyId)?.dates ?? []);
  return [...dates].sort()[0] ?? null;
}

export function admittedDates(
  attendee: DraftAttendee,
  groups: readonly DraftFamilyGroup[],
): FestivalDate[] {
  switch (attendee.mode) {
    case "days":
      return attendee.dates;
    case "family":
      return groups.find((g) => g.id === attendee.familyId)?.dates ?? [];
    case "all_days": {
      const first = attendee.allDaysFirstVisit;
      return FESTIVAL_DATES.filter((date) => first === null || date >= first);
    }
  }
}

export function needsAgeCheck(
  attendee: DraftAttendee,
  groups: readonly DraftFamilyGroup[],
): boolean {
  const first = firstVisit(attendee, groups);
  return (
    attendee.ageText.trim() !== "" &&
    first !== null &&
    attendee.ageCheckedFor !== first
  );
}

export function displayName(attendee: DraftAttendee, index: number): string {
  return attendee.name.trim() || `Person ${index + 1}`;
}

function toggle<T extends DatedPick>(list: T[], pick: T): T[] {
  const exists = list.some(
    (p) => p.attendeeId === pick.attendeeId && p.date === pick.date,
  );
  return exists
    ? list.filter(
        (p) => !(p.attendeeId === pick.attendeeId && p.date === pick.date),
      )
    : [...list, pick];
}

function updateAttendee(
  draft: Draft,
  id: string,
  update: (attendee: DraftAttendee) => DraftAttendee,
): Draft {
  return {
    ...draft,
    attendees: draft.attendees.map((a) => (a.id === id ? update(a) : a)),
  };
}

function apply(draft: Draft, action: Action): Draft {
  switch (action.type) {
    case "attendeeAdded":
      return {
        ...draft,
        attendees: [
          ...draft.attendees,
          {
            id: action.id,
            name: "",
            mode: "days",
            dates: [],
            allDaysFirstVisit: null,
            familyId: null,
            ageText: "",
            ageCheckedFor: null,
          },
        ],
      };
    case "attendeeRemoved":
      return {
        ...draft,
        attendees: draft.attendees.filter((a) => a.id !== action.id),
      };
    case "attendeeChanged":
      return updateAttendee(draft, action.id, (a) => ({
        ...a,
        ...action.changes,
      }));
    case "attendeeAgeChanged":
      return updateAttendee(draft, action.id, (a) => ({
        ...a,
        ageText: action.ageText,
        ageCheckedFor: firstVisit(a, draft.familyGroups),
      }));
    case "attendeeAgeConfirmed":
      return updateAttendee(draft, action.id, (a) => ({
        ...a,
        ageCheckedFor: firstVisit(a, draft.familyGroups),
      }));
    case "familyGroupAdded":
      return {
        ...draft,
        familyGroups: [...draft.familyGroups, { id: action.id, dates: [] }],
      };
    case "familyGroupRemoved":
      return {
        ...draft,
        familyGroups: draft.familyGroups.filter((g) => g.id !== action.id),
        attendees: draft.attendees.map((a) =>
          a.familyId === action.id ? { ...a, familyId: null } : a,
        ),
      };
    case "familyGroupDatesChanged":
      return {
        ...draft,
        familyGroups: draft.familyGroups.map((g) =>
          g.id === action.id ? { ...g, dates: action.dates } : g,
        ),
      };
    case "sticksChanged":
      return { ...draft, sticksPairs: action.pairs };
    case "dinnerToggled":
      return { ...draft, dinners: toggle(draft.dinners, action.pick) };
    case "workshopToggled":
      return { ...draft, workshops: toggle(draft.workshops, action.pick) };
    case "bookerChanged":
      return { ...draft, booker: { ...draft.booker, ...action.changes } };
    case "promoApplied":
      return { ...draft, promoCode: action.code };
    case "promoRemoved":
      return { ...draft, promoCode: null };
    case "noticeDismissed":
      return {
        ...draft,
        notices: draft.notices.filter((_, i) => i !== action.index),
      };
  }
}

// Removes dinner and workshop picks that no longer match someone's attendance and explains why.
function pruneExtras(previous: Draft, next: Draft): Draft {
  const notices: string[] = [];
  const keep =
    (label: string, allowedDates: readonly FestivalDate[] | null) =>
    (pick: DatedPick): boolean => {
      const index = next.attendees.findIndex((a) => a.id === pick.attendeeId);
      const attendee = next.attendees[index];
      if (attendee === undefined) {
        const before = previous.attendees.findIndex(
          (a) => a.id === pick.attendeeId,
        );
        const removed = previous.attendees[before];
        const name = removed
          ? displayName(removed, before)
          : "a removed person";
        notices.push(
          `Removed ${name}'s ${label} on ${DATE_LABELS[pick.date]} because they were removed from the booking.`,
        );
        return false;
      }
      const attending = admittedDates(attendee, next.familyGroups).includes(
        pick.date,
      );
      const allowed = allowedDates === null || allowedDates.includes(pick.date);
      if (!attending || !allowed) {
        notices.push(
          `Removed ${displayName(attendee, index)}'s ${label} on ${DATE_LABELS[pick.date]} because they're no longer attending that day.`,
        );
        return false;
      }
      return true;
    };

  const dinners = next.dinners.filter(keep("Dinner Plate", null));
  const workshops = next.workshops.filter(
    keep("Garba Workshop", WORKSHOP_DATES),
  );
  if (notices.length === 0) return next;
  return {
    ...next,
    dinners,
    workshops,
    notices: [...next.notices, ...notices],
  };
}

export function bookingReducer(draft: Draft, action: Action): Draft {
  return pruneExtras(draft, apply(draft, action));
}

function toAdmission(
  attendee: DraftAttendee,
  age: number,
  first: FestivalDate,
): Admission | null {
  const category = categoryForAge(age);
  const dates = [...attendee.dates].sort();
  switch (attendee.mode) {
    case "days":
      return category === "under_five"
        ? { kind: "free", dates }
        : { kind: "day", category, dates };
    case "all_days":
      return category === "under_five"
        ? { kind: "free", dates: FESTIVAL_DATES.filter((d) => d >= first) }
        : { kind: "all_days", category };
    case "family":
      return attendee.familyId === null
        ? null
        : { kind: "family", familyId: attendee.familyId };
  }
}

// Null until every attendee has a parseable age and a first day; the server re-checks everything.
export function toSelection(draft: Draft): Selection | null {
  if (draft.attendees.length === 0) return null;
  const attendees = [];
  for (const attendee of draft.attendees) {
    const age = parseAgeInput(attendee.ageText);
    const first = firstVisit(attendee, draft.familyGroups);
    if (!age.ok || first === null) return null;
    const admission = toAdmission(attendee, age.age, first);
    if (admission === null) return null;
    attendees.push({
      id: attendee.id,
      name: attendee.name.trim(),
      firstVisitDate: first,
      ageAtFirstVisit: age.age,
      admission,
    });
  }
  return {
    attendees,
    familyGroups: draft.familyGroups.map((g) => ({
      id: g.id,
      dates: [...g.dates].sort(),
    })),
    extras: {
      sticksPairs: draft.sticksPairs,
      dinners: draft.dinners,
      workshops: draft.workshops.filter(
        (
          w,
        ): w is { attendeeId: string; date: (typeof WORKSHOP_DATES)[number] } =>
          (WORKSHOP_DATES as readonly string[]).includes(w.date),
      ),
    },
    ...(draft.promoCode === null ? {} : { promoCode: draft.promoCode }),
  };
}

export function toBooker(booker: DraftBooker): Booker {
  const age = parseAgeInput(booker.ageText);
  const phone = booker.phone.trim();
  return {
    name: booker.name.trim(),
    email: booker.email.trim(),
    age: age.ok ? age.age : Number.NaN,
    ...(phone === "" ? {} : { phone }),
  };
}
