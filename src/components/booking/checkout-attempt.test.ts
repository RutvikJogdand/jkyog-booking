import { describe, expect, it } from "@jest/globals";
import {
  classifyCheckout,
  clearPending,
  readPending,
  writePending,
  type PendingCheckout,
} from "./checkout-attempt";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

const attempt: PendingCheckout = {
  key: "11111111-1111-1111-1111-111111111111",
  content: '{"simulation":"success"}',
};

const quote = {
  lines: [],
  subtotalCents: 0,
  discountCents: 0,
  totalCents: 0,
  currency: "USD",
};

describe("classifyCheckout", () => {
  it("confirms a saved booking", () => {
    expect(
      classifyCheckout(201, {
        bookingId: "SU-23456789",
        receiptPath: "/confirmation/" + "a".repeat(43),
        quote,
      }).kind,
    ).toBe("confirmed");
  });

  it("treats a success response without a receipt as uncertain", () => {
    expect(classifyCheckout(201, { bookingId: "SU-23456789" }).kind).toBe(
      "uncertain",
    );
    expect(classifyCheckout(200, null).kind).toBe("uncertain");
  });

  it("treats timeouts and server failures as uncertain", () => {
    expect(
      classifyCheckout(503, {
        error: { code: "database_unavailable", message: "x", fields: [] },
      }).kind,
    ).toBe("uncertain");
    expect(classifyCheckout(500, null).kind).toBe("uncertain");
  });

  it("returns structured product ids for a stock conflict", () => {
    const result = classifyCheckout(409, {
      error: {
        code: "out_of_stock",
        message: "Not enough left.",
        fields: [],
        productIds: ["garba_workshop"],
      },
    });
    expect(result).toMatchObject({
      kind: "rejected",
      code: "out_of_stock",
      productIds: ["garba_workshop"],
    });
  });

  it("treats a definite decline as a rejection, not an uncertain result", () => {
    expect(
      classifyCheckout(402, {
        error: {
          code: "payment_declined",
          message: "Payment declined (simulated).",
          fields: [],
        },
      }).kind,
    ).toBe("rejected");
  });
});

describe("pending checkout storage", () => {
  it("round-trips the exact request and key", () => {
    const storage = memoryStorage();
    expect(writePending(storage, attempt)).toEqual({ ok: true });
    expect(readPending(storage)).toEqual({ status: "pending", attempt });
    clearPending(storage);
    expect(readPending(storage)).toEqual({ status: "empty" });
  });

  it("reports corrupt saved data instead of inventing a new checkout", () => {
    const storage = memoryStorage();
    storage.setItem("jkyog-pending-checkout", "{");
    expect(readPending(storage).status).toBe("corrupt");
  });

  it("reports storage that cannot be used", () => {
    expect(readPending(null).status).toBe("unavailable");
    expect(writePending(null, attempt)).toEqual({ ok: false });
  });
});
