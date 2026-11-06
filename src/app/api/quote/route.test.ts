import { describe, expect, it } from "@jest/globals";
import { POST } from "./route";

function post(body: unknown, raw = false): Promise<Response> {
  return POST(
    new Request("http://localhost/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw ? String(body) : JSON.stringify(body),
    }),
  );
}

const noExtras = { sticksPairs: 0, dinners: [], workshops: [] };

const oneAdultDay = {
  id: "a",
  name: "Asha",
  firstVisitDate: "2026-11-10",
  ageAtFirstVisit: 30,
  admission: { kind: "day", category: "adult", dates: ["2026-11-10"] },
};

const family = [
  ["p1", 40],
  ["p2", 38],
  ["k1", 9],
  ["k2", 6],
].map(([id, age]) => ({
  id,
  name: `Member ${String(id).replace(/\d/g, "")}`,
  firstVisitDate: "2026-11-10",
  ageAtFirstVisit: age,
  admission: { kind: "family", familyId: "f1" },
}));

const familyGroups = [{ id: "f1", dates: ["2026-11-10", "2026-11-11"] }];

describe("POST /api/quote", () => {
  it("prices the PRD example: a $15 ticket plus $5 sticks with FLAT20 totals $0", async () => {
    const response = await post({
      selection: {
        attendees: [oneAdultDay],
        familyGroups: [],
        extras: { ...noExtras, sticksPairs: 1 },
        promoCode: "FLAT20",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      lines: [
        {
          productId: "day_adult",
          description: "Adult Day Pass",
          quantity: 1,
          unitPriceCents: 1500,
          amountCents: 1500,
        },
        {
          productId: "dandiya_sticks",
          description: "Dandiya Sticks",
          quantity: 1,
          unitPriceCents: 500,
          amountCents: 500,
        },
      ],
      subtotalCents: 2000,
      discountCents: 2000,
      totalCents: 0,
      currency: "USD",
    });
  });

  it("applies SEVA10 to a Family Pass on two dates", async () => {
    const response = await post({
      selection: {
        attendees: family,
        familyGroups,
        extras: noExtras,
        promoCode: "SEVA10",
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      subtotalCents: 8000,
      discountCents: 800,
      totalCents: 7200,
    });
  });

  it.each([
    [
      "FLAT20",
      [oneAdultDay],
      [],
      "FLAT20 needs a subtotal of at least $20.00, including extras.",
    ],
    [
      "KIDSFREE",
      family,
      familyGroups,
      "This code only applies to child tickets.",
    ],
    ["EXPIRED5", [oneAdultDay], [], "EXPIRED5 has expired."],
    ["MAXEDOUT", [oneAdultDay], [], "MAXEDOUT has reached its usage limit."],
    ["seva10", [oneAdultDay], [], "This code is not recognised."],
  ])(
    "rejects %s with a 422 and an explanation",
    async (promoCode, attendees, groups, message) => {
      const response = await post({
        selection: {
          attendees,
          familyGroups: groups,
          extras: noExtras,
          promoCode,
        },
      });

      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({
        error: {
          code: "invalid_selection",
          message: "Some booking details need fixing.",
          fields: [{ path: "selection.promoCode", message }],
        },
      });
    },
  );

  it("returns booking-rule problems with paths from the request body", async () => {
    const response = await post({
      selection: {
        attendees: [{ ...oneAdultDay, ageAtFirstVisit: 151 }],
        familyGroups: [],
        extras: noExtras,
      },
    });

    expect(response.status).toBe(422);
    const body = (await response.json()) as {
      error: { fields: { path: string }[] };
    };
    expect(body.error.fields.map((field) => field.path)).toEqual([
      "selection.attendees.0.ageAtFirstVisit",
    ]);
  });

  it("rejects a browser-supplied price as an unexpected field", async () => {
    const response = await post({
      selection: {
        attendees: [{ ...oneAdultDay, unitPriceCents: 1 }],
        familyGroups: [],
        extras: noExtras,
      },
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      error: { code: string; fields: { path: string }[] };
    };
    expect(body.error.code).toBe("invalid_request");
    expect(body.error.fields.map((field) => field.path)).toEqual([
      "selection.attendees.0",
    ]);
  });

  it("rejects a date outside the festival", async () => {
    const response = await post({
      selection: {
        attendees: [
          {
            ...oneAdultDay,
            admission: {
              kind: "day",
              category: "adult",
              dates: ["2026-11-15"],
            },
          },
        ],
        familyGroups: [],
        extras: noExtras,
      },
    });

    expect(response.status).toBe(400);
  });

  it("rejects malformed JSON", async () => {
    const response = await post("{not json", true);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "invalid_json",
        message: "The request body must be valid JSON.",
        fields: [],
      },
    });
  });
});
