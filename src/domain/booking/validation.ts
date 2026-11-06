import { categoryForAge, isValidAge, MAX_AGE } from "./age";
import {
  FESTIVAL_DATES,
  type Attendee,
  type Booker,
  type FamilyGroup,
  type FestivalDate,
  type Selection,
} from "./types";

export const TEXT_LIMITS = {
  name: 200,
  email: 254,
  phone: 30,
  promo: 50,
  id: 100,
} as const;

export const MIN_BOOKER_AGE = 18;
export const MAX_STICKS_PAIRS = 10;
export const FAMILY_ADULTS = 2;
export const FAMILY_CHILDREN = 2;

// Paths are relative to the selection, e.g. "attendees.0.ageAtFirstVisit".
export interface ValidationIssue {
  path: string;
  message: string;
}

type AddIssue = (path: string, message: string) => void;

export function validateSelection(selection: Selection): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add: AddIssue = (path, message) => issues.push({ path, message });

  const groupsById = new Map(selection.familyGroups.map((g) => [g.id, g]));
  const attendeesById = new Map(selection.attendees.map((a) => [a.id, a]));

  if (selection.attendees.length === 0) {
    add("attendees", "Add at least one person who is coming.");
  }
  checkUniqueIds(selection.attendees, "attendees", add);
  checkUniqueIds(selection.familyGroups, "familyGroups", add);

  selection.familyGroups.forEach((group, i) => {
    checkDates(group.dates, `familyGroups.${i}.dates`, add);
  });

  selection.attendees.forEach((attendee, i) => {
    validateAttendee(attendee, `attendees.${i}`, groupsById, add);
  });

  selection.familyGroups.forEach((group, i) => {
    checkFamilyMembers(group, selection.attendees, `familyGroups.${i}`, add);
  });

  const { sticksPairs, dinners, workshops } = selection.extras;
  if (
    !Number.isInteger(sticksPairs) ||
    sticksPairs < 0 ||
    sticksPairs > MAX_STICKS_PAIRS
  ) {
    add(
      "extras.sticksPairs",
      `Choose between 0 and ${MAX_STICKS_PAIRS} pairs.`,
    );
  }

  checkDatedExtras(
    dinners,
    "extras.dinners",
    "Dinner Plate",
    attendeesById,
    groupsById,
    add,
  );
  checkDatedExtras(
    workshops,
    "extras.workshops",
    "Garba Workshop",
    attendeesById,
    groupsById,
    add,
  );

  return issues;
}

// Paths are relative to the booker, e.g. "email".
export function validateBooker(booker: Booker): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if(!(/^[\p{L}\p{M}' \-]+$/u.test(booker.name.trim()))) {
    if (booker.name.trim() === "") {
      issues.push({ path: "name", message: "Enter your name." });
    }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(booker.email.trim())) {
    issues.push({
      path: "email",
      message: "Enter an email like name@example.com.",
    });
  }
  if (!isValidAge(booker.age)) {
    issues.push({
      path: "age",
      message: `Enter a whole-number age from ${MIN_BOOKER_AGE} to ${MAX_AGE}.`,
    });
  } else if (booker.age < MIN_BOOKER_AGE) {
    issues.push({
      path: "age",
      message: `The person booking must be ${MIN_BOOKER_AGE} or older.`,
    });
  }
  if (
    booker.phone !== undefined &&
    !/^\+?[0-9 ()\-.]{7,20}$/.test(booker.phone.trim())
  ) {
    issues.push({
      path: "phone",
      message: "Enter a phone number using digits, spaces, +, - or brackets.",
    });
  }
  return issues;
}

// The dates an attendee's admission lets them attend, and so the only dates their extras may use.
export function admittedDates(
  attendee: Attendee,
  groupsById: ReadonlyMap<string, FamilyGroup>,
): readonly FestivalDate[] {
  const { admission } = attendee;
  switch (admission.kind) {
    case "day":
    case "free":
      return admission.dates;
    case "family":
      return groupsById.get(admission.familyId)?.dates ?? [];
    case "all_days":
      return FESTIVAL_DATES.filter((date) => date >= attendee.firstVisitDate);
  }
}

function validateAttendee(
  attendee: Attendee,
  path: string,
  groupsById: ReadonlyMap<string, FamilyGroup>,
  add: AddIssue,
): void {
  if (attendee.name.trim() === "") {
    add(`${path}.name`, "Enter a name.");
  }
  if(!(/^[\p{L}\p{M}' \-]+$/u.test(attendee.name.trim()))) {
    add(`${path}.name`, "Enter a valid name using letters, spaces, hyphens or apostrophes.");
  }

  if (!isValidAge(attendee.ageAtFirstVisit)) {
    add(
      `${path}.ageAtFirstVisit`,
      `Enter a whole-number age from 0 to ${MAX_AGE}.`,
    );
    return;
  }

  const category = categoryForAge(attendee.ageAtFirstVisit);
  const { admission } = attendee;

  if (admission.kind === "free") {
    if (category !== "under_five") {
      add(`${path}.admission`, "Free entry is only for children under 5.");
    }
  } else if (category === "under_five") {
    add(
      `${path}.admission`,
      admission.kind === "family"
        ? "Children under 5 come free and don't fill one of the two child places. Add them with their own days instead."
        : "Children under 5 get free entry and don't need a ticket.",
    );
  } else if (admission.kind !== "family" && admission.category !== category) {
    add(
      `${path}.admission.category`,
      `Age ${attendee.ageAtFirstVisit} on their first visit needs ${category === "adult" ? "an adult" : "a child"} ticket.`,
    );
  }

  if (admission.kind === "day" || admission.kind === "free") {
    checkDates(admission.dates, `${path}.admission.dates`, add);
    checkFirstVisit(attendee, admission.dates, path, add);
  } else if (admission.kind === "family") {
    const group = groupsById.get(admission.familyId);
    if (group === undefined) {
      add(`${path}.admission.familyId`, "Choose a Family Pass group.");
    } else {
      checkFirstVisit(attendee, group.dates, path, add);
    }
  }
}

function checkFirstVisit(
  attendee: Attendee,
  dates: readonly FestivalDate[],
  path: string,
  add: AddIssue,
): void {
  const earliest = [...dates].sort()[0];
  if (earliest !== undefined && attendee.firstVisitDate !== earliest) {
    add(
      `${path}.firstVisitDate`,
      `The first visit must be their earliest date, ${earliest}.`,
    );
  }
}

function checkFamilyMembers(
  group: FamilyGroup,
  attendees: readonly Attendee[],
  path: string,
  add: AddIssue,
): void {
  let adults = 0;
  let children = 0;
  for (const attendee of attendees) {
    const { admission } = attendee;
    if (
      admission.kind !== "family" ||
      admission.familyId !== group.id ||
      !isValidAge(attendee.ageAtFirstVisit)
    ) {
      continue;
    }
    const category = categoryForAge(attendee.ageAtFirstVisit);
    if (category === "adult") adults += 1;
    if (category === "child") children += 1;
  }

  if (adults !== FAMILY_ADULTS || children !== FAMILY_CHILDREN) {
    add(
      path,
      `A Family Pass needs exactly ${FAMILY_ADULTS} adults (12+) and ${FAMILY_CHILDREN} children (5–11). This group has ${adults} ${adults === 1 ? "adult" : "adults"} and ${children} ${children === 1 ? "child" : "children"}.`,
    );
  }
}

function checkDatedExtras(
  selections: readonly { attendeeId: string; date: FestivalDate }[],
  path: string,
  label: string,
  attendeesById: ReadonlyMap<string, Attendee>,
  groupsById: ReadonlyMap<string, FamilyGroup>,
  add: AddIssue,
): void {
  const seen = new Set<string>();
  selections.forEach(({ attendeeId, date }, i) => {
    const attendee = attendeesById.get(attendeeId);
    if (attendee === undefined) {
      add(`${path}.${i}.attendeeId`, "This person isn't in the booking.");
      return;
    }

    const key = `${attendeeId}|${date}`;
    if (seen.has(key)) {
      add(
        `${path}.${i}`,
        `${label} is already selected for ${attendee.name} on ${date}.`,
      );
      return;
    }
    seen.add(key);

    if (!admittedDates(attendee, groupsById).includes(date)) {
      add(`${path}.${i}.date`, `${attendee.name} isn't attending on ${date}.`);
    }
  });
}

function checkDates(
  dates: readonly FestivalDate[],
  path: string,
  add: AddIssue,
): void {
  if (dates.length === 0) {
    add(path, "Choose at least one date.");
  } else if (new Set(dates).size !== dates.length) {
    add(path, "Each date can only be chosen once.");
  }
}

function checkUniqueIds(
  items: readonly { id: string }[],
  path: string,
  add: AddIssue,
): void {
  const seen = new Set<string>();
  items.forEach(({ id }, i) => {
    if (seen.has(id)) {
      add(`${path}.${i}.id`, "This ID is used more than once.");
    }
    seen.add(id);
  });
}
