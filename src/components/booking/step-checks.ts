import {
  categoryForAge,
  parseAgeInput,
  type AgeInputError,
} from "@/domain/booking/age";
import type { ProductId, Selection } from "@/domain/booking/types";
import { validateBooker, validateSelection } from "@/domain/booking/validation";
import { countUnits } from "@/domain/booking/inventory";
import {
  displayName,
  firstVisit,
  needsAgeCheck,
  parseSticks,
  toBooker,
  type Draft,
} from "./booking-reducer";
import { TEXT_LIMITS } from "@/domain/booking/validation";
import { DATE_LABELS } from "./format";

export type Availability = Record<ProductId, number>;
export type ProductNames = Record<ProductId, string>;

// `key` says where the problem is shown: "general", "attendee:<id>", "group:<id>",
// "extras" or "booker.<field>". `label` names it in the error summary.
export interface UiIssue {
  key: string;
  label: string;
  message: string;
  fieldId?: string;
}

export const AGE_MESSAGES: Record<AgeInputError, string> = {
  empty: "Enter their age.",
  negative: "An age can't be negative.",
  fractional: "Enter the age as a whole number.",
  not_a_number: "Enter the age as a number, like 9.",
  too_high: "Enter an age of 150 or less.",
};

function dedupe(issues: UiIssue[]): UiIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const id = `${issue.key}|${issue.message}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function soldOutProduct(
  mode: Draft["attendees"][number]["mode"],
  age: number,
): ProductId | null {
  const category = categoryForAge(age);
  if (mode === "family") return "family";
  if (category === "under_five") return null;
  return mode === "days" ? `day_${category}` : `all_days_${category}`;
}

export function stepOneIssues(
  draft: Draft,
  selection: Selection | null,
  availability: Availability,
  names: ProductNames,
): UiIssue[] {
  const issues: UiIssue[] = [];
  if (draft.attendees.length === 0) {
    issues.push({
      key: "general",
      label: "People",
      message: "Add at least one person who is coming.",
      fieldId: "add-person",
    });
  }

  draft.attendees.forEach((attendee, i) => {
    const key = `attendee:${attendee.id}`;
    const label = displayName(attendee, i);
    const add = (message: string, fieldId: string) =>
      issues.push({ key, label, message, fieldId });

    if (attendee.name.trim() === "")
      add("Enter a name.", `${attendee.id}-name`);
    if (attendee.name.length > TEXT_LIMITS.name) {
      add(
        `Use ${TEXT_LIMITS.name} characters or fewer for the name.`,
        `${attendee.id}-name`,
      );
    }
    if (attendee.mode === "days" && attendee.dates.length === 0) {
      add("Choose at least one day.", `${attendee.id}-dates`);
    }
    if (attendee.mode === "all_days" && attendee.allDaysFirstVisit === null) {
      add("Choose the first day they'll come.", `${attendee.id}-first`);
    }
    if (attendee.mode === "family" && attendee.familyId === null) {
      add(
        draft.familyGroups.length === 0
          ? "Add a Family Pass below first, then choose it here."
          : "Choose a Family Pass group.",
        `${attendee.id}-family`,
      );
    }

    const first = firstVisit(attendee, draft.familyGroups);
    if (first === null) return;
    const age = parseAgeInput(attendee.ageText);
    if (!age.ok) {
      add(AGE_MESSAGES[age.error], `${attendee.id}-age`);
      return;
    }
    if (needsAgeCheck(attendee, draft.familyGroups)) {
      add(
        `Their first day is now ${DATE_LABELS[first]}. Check their age for that day.`,
        `${attendee.id}-age`,
      );
    }
    const product = soldOutProduct(attendee.mode, age.age);
    if (product !== null && availability[product] === 0) {
      add(`${names[product]} is sold out.`, `${attendee.id}-mode`);
    }
  });

  draft.familyGroups.forEach((group, j) => {
    if (group.dates.length === 0) {
      issues.push({
        key: `group:${group.id}`,
        label: `Family Pass ${j + 1}`,
        message: "Choose at least one date.",
        fieldId: `group-${group.id}-dates`,
      });
    }
  });

  if (selection !== null) {
    for (const issue of validateSelection(selection)) {
      const [section, index] = issue.path.split(".");
      if (section === "attendees" && index !== undefined) {
        const i = Number(index);
        const attendee = draft.attendees[i];
        if (attendee) {
          issues.push({
            key: `attendee:${attendee.id}`,
            label: displayName(attendee, i),
            message: issue.message,
            fieldId: attendeeField(attendee.id, issue.path),
          });
        }
      } else if (section === "attendees") {
        issues.push({
          key: "general",
          label: "People",
          message: issue.message,
          fieldId: "add-person",
        });
      } else if (section === "familyGroups" && index !== undefined) {
        const j = Number(index);
        const group = draft.familyGroups[j];
        if (group) {
          issues.push({
            key: `group:${group.id}`,
            label: `Family Pass ${j + 1}`,
            message: issue.message,
            fieldId: `group-${group.id}-dates`,
          });
        }
      }
    }
    const units = countUnits(selection);
    for (const id of [
      "day_adult",
      "day_child",
      "all_days_adult",
      "all_days_child",
      "family",
    ] as const) {
      if (units[id] > availability[id]) {
        issues.push({
          key: "general",
          label: "Tickets",
          fieldId: "add-person",
          message: `Only ${availability[id]} ${names[id]} left, and this booking asks for ${units[id]}.`,
        });
      }
    }
  }

  return dedupe(issues);
}

export function stepTwoIssues(
  draft: Draft,
  selection: Selection | null,
  availability: Availability,
): UiIssue[] {
  const issues: UiIssue[] = [];
  if (selection !== null) {
    for (const issue of validateSelection(selection)) {
      if (issue.path.startsWith("extras")) {
        issues.push({
          key: "extras",
          label: "Extras",
          message: issue.message,
          fieldId: issue.path.includes("sticks") ? "sticks" : "extras",
        });
      }
    }
  }
  const sticks = parseSticks(draft.sticksText);
  if (!sticks.ok) {
    issues.push({
      key: "extras",
      label: "Extras",
      message: sticks.message,
      fieldId: "sticks",
    });
  } else if (sticks.pairs > availability.dandiya_sticks) {
    issues.push({
      key: "extras",
      label: "Extras",
      message: `Only ${availability.dandiya_sticks} pairs of Dandiya Sticks are left.`,
      fieldId: "sticks",
    });
  }
  if (draft.dinners.length > availability.dinner_plate) {
    issues.push({
      key: "extras",
      label: "Extras",
      message: `Only ${availability.dinner_plate} Dinner Plates are left.`,
      fieldId: "extras",
    });
  }
  if (draft.workshops.length > availability.garba_workshop) {
    issues.push({
      key: "extras",
      label: "Extras",
      message: `Only ${availability.garba_workshop} Garba Workshop ${availability.garba_workshop === 1 ? "place is" : "places are"} left in total for Wednesday and Friday together, and this booking asks for ${draft.workshops.length}.`,
      fieldId: "extras",
    });
  }
  if (draft.booker.name.length > TEXT_LIMITS.name) {
    issues.push({
      key: "booker.name",
      label: "Your details",
      message: `Use ${TEXT_LIMITS.name} characters or fewer for your name.`,
      fieldId: "booker-name",
    });
  }
  if (draft.booker.email.length > TEXT_LIMITS.email) {
    issues.push({
      key: "booker.email",
      label: "Your details",
      message: `Use ${TEXT_LIMITS.email} characters or fewer for the email.`,
      fieldId: "booker-email",
    });
  }
  if (draft.booker.phone.length > TEXT_LIMITS.phone) {
    issues.push({
      key: "booker.phone",
      label: "Your details",
      message: `Use ${TEXT_LIMITS.phone} characters or fewer for the phone number.`,
      fieldId: "booker-phone",
    });
  }
  for (const issue of validateBooker(toBooker(draft.booker))) {
    issues.push({
      key: `booker.${issue.path}`,
      label: "Your details",
      message: issue.message,
      fieldId: `booker-${issue.path === "age" ? "ageText" : issue.path}`,
    });
  }
  return dedupe(issues);
}

function attendeeField(id: string, path: string): string {
  if (path.endsWith(".name")) return `${id}-name`;
  if (path.includes("ageAtFirstVisit")) return `${id}-age`;
  if (path.includes("dates")) return `${id}-dates`;
  if (path.includes("firstVisitDate")) return `${id}-first`;
  if (path.includes("familyId")) return `${id}-family`;
  return `${id}-mode`;
}

export function fieldForServerPath(
  path: string,
  draft: Draft,
): { step: 1 | 2 | 3; fieldId: string } | null {
  if (path.startsWith("booker.")) {
    const field = path.slice("booker.".length);
    return {
      step: 2,
      fieldId: `booker-${field === "age" ? "ageText" : field}`,
    };
  }
  const attendeeMatch = /^selection\.attendees\.(\d+)/.exec(path);
  if (attendeeMatch?.[1] !== undefined) {
    const attendee = draft.attendees[Number(attendeeMatch[1])];
    return attendee
      ? { step: 1, fieldId: attendeeField(attendee.id, path) }
      : null;
  }
  if (path.startsWith("selection.extras"))
    return { step: 2, fieldId: "extras" };
  if (path === "selection.promoCode") return { step: 3, fieldId: "promo" };
  return null;
}

export function messagesForField(
  issues: readonly UiIssue[] | null,
  fieldId: string,
): string[] {
  return (issues ?? [])
    .filter((issue) => issue.fieldId === fieldId)
    .map((issue) => issue.message);
}

export function issuesFor(
  issues: readonly UiIssue[] | null,
  key: string,
): string[] {
  return (issues ?? [])
    .filter((issue) => issue.key === key)
    .map((issue) => issue.message);
}
