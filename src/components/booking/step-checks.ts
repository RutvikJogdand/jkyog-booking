import {
  categoryForAge,
  parseAgeInput,
  type AgeInputError,
} from "@/domain/booking/age";
import type { ProductId, Selection } from "@/domain/booking/types";
import { validateBooker, validateSelection } from "@/domain/booking/validation";
import {
  displayName,
  firstVisit,
  needsAgeCheck,
  toBooker,
  type Draft,
} from "./booking-reducer";
import { DATE_LABELS } from "./format";

export type Availability = Record<ProductId, number>;
export type ProductNames = Record<ProductId, string>;

// `key` says where the problem is shown: "general", "attendee:<id>", "group:<id>",
// "extras" or "booker.<field>". `label` names it in the error summary.
export interface UiIssue {
  key: string;
  label: string;
  message: string;
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
    });
  }

  draft.attendees.forEach((attendee, i) => {
    const key = `attendee:${attendee.id}`;
    const label = displayName(attendee, i);
    const add = (message: string) => issues.push({ key, label, message });

    if (attendee.name.trim() === "") add("Enter a name.");
    if (attendee.mode === "days" && attendee.dates.length === 0) {
      add("Choose at least one day.");
    }
    if (attendee.mode === "all_days" && attendee.allDaysFirstVisit === null) {
      add("Choose the first day they'll come.");
    }
    if (attendee.mode === "family" && attendee.familyId === null) {
      add(
        draft.familyGroups.length === 0
          ? "Add a Family Pass below first, then choose it here."
          : "Choose a Family Pass group.",
      );
    }

    const first = firstVisit(attendee, draft.familyGroups);
    if (first === null) return;
    const age = parseAgeInput(attendee.ageText);
    if (!age.ok) {
      add(AGE_MESSAGES[age.error]);
      return;
    }
    if (needsAgeCheck(attendee, draft.familyGroups)) {
      add(
        `Their first day is now ${DATE_LABELS[first]}. Check their age for that day.`,
      );
    }
    const product = soldOutProduct(attendee.mode, age.age);
    if (product !== null && availability[product] === 0) {
      add(`${names[product]} is sold out.`);
    }
  });

  draft.familyGroups.forEach((group, j) => {
    if (group.dates.length === 0) {
      issues.push({
        key: `group:${group.id}`,
        label: `Family Pass ${j + 1}`,
        message: "Choose at least one date.",
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
          });
        }
      } else if (section === "attendees") {
        issues.push({
          key: "general",
          label: "People",
          message: issue.message,
        });
      } else if (section === "familyGroups" && index !== undefined) {
        const j = Number(index);
        const group = draft.familyGroups[j];
        if (group) {
          issues.push({
            key: `group:${group.id}`,
            label: `Family Pass ${j + 1}`,
            message: issue.message,
          });
        }
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
        issues.push({ key: "extras", label: "Extras", message: issue.message });
      }
    }
  }
  if (draft.sticksPairs > availability.dandiya_sticks) {
    issues.push({
      key: "extras",
      label: "Extras",
      message: `Only ${availability.dandiya_sticks} pairs of Dandiya Sticks are left.`,
    });
  }
  if (draft.dinners.length > availability.dinner_plate) {
    issues.push({
      key: "extras",
      label: "Extras",
      message: `Only ${availability.dinner_plate} Dinner Plates are left.`,
    });
  }
  if (draft.workshops.length > availability.garba_workshop) {
    issues.push({
      key: "extras",
      label: "Extras",
      message: `Only ${availability.garba_workshop} Garba Workshop places are left.`,
    });
  }
  for (const issue of validateBooker(toBooker(draft.booker))) {
    issues.push({
      key: `booker.${issue.path}`,
      label: "Your details",
      message: issue.message,
    });
  }
  return dedupe(issues);
}

export function issuesFor(
  issues: readonly UiIssue[] | null,
  key: string,
): string[] {
  return (issues ?? [])
    .filter((issue) => issue.key === key)
    .map((issue) => issue.message);
}
