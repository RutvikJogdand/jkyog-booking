import type { AgeCategory } from "./types";

export const CHILD_MIN_AGE = 5;
export const ADULT_MIN_AGE = 12;
export const MAX_AGE = 150;

export type AgeInputError =
  "empty" | "negative" | "fractional" | "not_a_number" | "too_high";

export type AgeInputResult =
  { ok: true; age: number } | { ok: false; error: AgeInputError };

export function isValidAge(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_AGE
  );
}

// Strict on purpose: Number("") is 0 and parseInt("12abc") is 12, and neither may become an age.
export function parseAgeInput(text: string): AgeInputResult {
  const trimmed = text.trim();
  if (trimmed === "") {
    return { ok: false, error: "empty" };
  }
  if (/^-\d+(\.\d+)?$/.test(trimmed)) {
    return { ok: false, error: "negative" };
  }
  if (/^\d*\.\d+$/.test(trimmed)) {
    return { ok: false, error: "fractional" };
  }
  if (!/^\d+$/.test(trimmed)) {
    return { ok: false, error: "not_a_number" };
  }

  const age = Number(trimmed);
  return isValidAge(age) ? { ok: true, age } : { ok: false, error: "too_high" };
}

// The age is the one declared for the attendee's first visit; the category stays fixed for every booked date.
export function categoryForAge(ageAtFirstVisit: number): AgeCategory {
  if (!isValidAge(ageAtFirstVisit)) {
    throw new RangeError(`Invalid age: ${ageAtFirstVisit}`);
  }
  if (ageAtFirstVisit < CHILD_MIN_AGE) {
    return "under_five";
  }
  return ageAtFirstVisit < ADULT_MIN_AGE ? "child" : "adult";
}
