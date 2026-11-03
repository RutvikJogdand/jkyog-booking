import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";

const mocks = { checkout: jest.fn<(...args: unknown[]) => Promise<unknown>>() };

jest.mock("@/server/db", () => ({ getPool: () => ({}) }));
jest.mock("@/server/booking-service", () => ({
  checkout: (...args: unknown[]) => mocks.checkout(...args),
}));

let post: (request: Request) => Promise<Response>;

beforeAll(async () => {
  const route = await import("./route");
  post = (request) => route.POST(request);
});

const requestBody = {
  booker: { name: "Priya", email: "priya@example.com", age: 35 },
  selection: {
    attendees: [
      {
        id: "a",
        name: "Asha",
        firstVisitDate: "2026-11-10",
        ageAtFirstVisit: 30,
        admission: { kind: "day", category: "adult", dates: ["2026-11-10"] },
      },
    ],
    familyGroups: [],
    extras: { sticksPairs: 0, dinners: [], workshops: [] },
  },
  expectedTotalCents: 1500,
  simulation: "success",
};

function send(): Promise<Response> {
  return post(
    new Request("http://localhost/api/bookings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": "11111111-1111-1111-1111-111111111111",
      },
      body: JSON.stringify(requestBody),
    }),
  );
}

beforeEach(() => {
  mocks.checkout.mockReset();
});

describe("POST /api/bookings stock response", () => {
  it("returns the short product ids instead of only a sentence", async () => {
    mocks.checkout.mockResolvedValue({
      kind: "out_of_stock",
      productIds: ["dinner_plate", "garba_workshop"],
    });

    const response = await send();
    const body = (await response.json()) as {
      error: { code: string; message: string; productIds: string[] };
    };

    expect(response.status).toBe(409);
    expect(body.error.code).toBe("out_of_stock");
    expect(body.error.productIds).toEqual(["dinner_plate", "garba_workshop"]);
    expect(body.error.message).toContain("Dinner Plate");
    expect(body.error.message).toContain("Garba Workshop");
  });
});
