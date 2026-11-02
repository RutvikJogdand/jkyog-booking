import { describe, expect, it } from "@jest/globals";
import { categoryForAge, isValidAge, parseAgeInput } from "./age";

describe("categoryForAge", () => {
  it.each([
    [0, "under_five"],
    [4, "under_five"],
    [5, "child"],
    [11, "child"],
    [12, "adult"],
    [18, "adult"],
    [90, "adult"],
    [150, "adult"],
  ] as const)("classifies age %i as %s", (age, category) => {
    expect(categoryForAge(age)).toBe(category);
  });

  it("needs adult admission when someone turns 12 before their first visit", () => {
    // 11 on Nov 10, turns 12 on Nov 12, first attends Nov 13.
    expect(categoryForAge(12)).toBe("adult");
  });

  it("keeps child admission for someone who first attends at 11, even if they turn 12 during the festival", () => {
    // The category depends only on the declared first-visit age, never on the booked date.
    expect(categoryForAge(11)).toBe("child");
  });

  it.each([-1, 4.5, 151, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid age %p",
    (age) => {
      expect(() => categoryForAge(age)).toThrow(RangeError);
    },
  );
});

describe("isValidAge", () => {
  it.each([0, 5, 12, 100, 150])("accepts %p", (value) => {
    expect(isValidAge(value)).toBe(true);
  });

  it.each([
    -1,
    11.5,
    151,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    "12",
    null,
    undefined,
  ])("rejects %p", (value) => {
    expect(isValidAge(value)).toBe(false);
  });
});

describe("parseAgeInput", () => {
  it.each([
    ["12", 12],
    [" 12 ", 12],
    ["05", 5],
    ["0", 0],
    ["150", 150],
  ])("accepts %p as %i", (text, age) => {
    expect(parseAgeInput(text)).toEqual({ ok: true, age });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["-3", "negative"],
    ["-2.5", "negative"],
    ["11.5", "fractional"],
    [".5", "fractional"],
    ["12abc", "not_a_number"],
    ["abc", "not_a_number"],
    ["1e1", "not_a_number"],
    ["0x10", "not_a_number"],
    ["+12", "not_a_number"],
    ["12.", "not_a_number"],
    ["151", "too_high"],
    ["99999999999999999999", "too_high"],
  ])("rejects %p as %s", (text, error) => {
    expect(parseAgeInput(text)).toEqual({ ok: false, error });
  });
});
