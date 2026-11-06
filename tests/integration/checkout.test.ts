import { afterAll, beforeEach, describe, expect, it } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import type { Selection } from "@/domain/booking/types";
import { findBookingByToken } from "@/server/booking-repository";
import { checkout, type CheckoutInput } from "@/server/booking-service";

// These tests delete every booking and reset stock. They run only when the URL is
// explicitly marked disposable and is not the same database as DATABASE_URL.
const connectionString = process.env.TEST_DATABASE_URL;
assertDisposableTestDatabase(connectionString);
const pool = new Pool({ connectionString });

function assertDisposableTestDatabase(
  url: string | undefined,
): asserts url is string {
  if (!url) throw new Error("TEST_DATABASE_URL is not set; refusing to run.");
  if (process.env.TEST_DATABASE_IS_DISPOSABLE !== "1") {
    throw new Error(
      "Set TEST_DATABASE_IS_DISPOSABLE=1 to confirm this database can be wiped.",
    );
  }
  const host = new URL(url).hostname;
  const local = host === "localhost" || host === "127.0.0.1";
  if (!local && !host.endsWith(".neon.tech")) {
    throw new Error(`Refusing to reset a database on ${host}.`);
  }
  const appUrl = process.env.DATABASE_URL;
  if (appUrl && databaseHost(new URL(appUrl).hostname) === databaseHost(host)) {
    throw new Error(
      "TEST_DATABASE_URL uses the same database host as DATABASE_URL. Refusing to reset it.",
    );
  }
}

function databaseHost(hostname: string): string {
  return hostname.replace("-pooler", "");
}

const STARTING_STOCK = {
  day_adult: 380,
  day_child: 260,
  all_days_adult: 0,
  all_days_child: 140,
  family: 95,
  dandiya_sticks: 900,
  dinner_plate: 1700,
  garba_workshop: 2,
};

async function stock(productId: keyof typeof STARTING_STOCK): Promise<number> {
  const { rows } = await pool.query<{ remaining: number }>(
    "SELECT remaining FROM inventory WHERE product_id = $1",
    [productId],
  );
  return rows[0]?.remaining ?? -1;
}

async function bookingCount(): Promise<number> {
  const { rows } = await pool.query<{ count: number }>(
    "SELECT count(*)::int AS count FROM bookings",
  );
  return rows[0]?.count ?? -1;
}

beforeEach(async () => {
  await pool.query("DELETE FROM booking_requests");
  await pool.query("DELETE FROM bookings");
  for (const [productId, remaining] of Object.entries(STARTING_STOCK)) {
    await pool.query(
      `INSERT INTO inventory (product_id, remaining) VALUES ($1, $2)
       ON CONFLICT (product_id) DO UPDATE SET remaining = EXCLUDED.remaining`,
      [productId, remaining],
    );
  }
});

afterAll(async () => {
  await pool.end();
});

const booker = { name: "Priya", email: "priya@example.com", age: 35 };

function adult(
  id: string,
  dates: Selection["attendees"][number]["firstVisitDate"][],
) {
  return {
    id,
    name: `Adult ${id.replace(/\d/g, "")}`,
    firstVisitDate: dates[0] ?? "2026-11-10",
    ageAtFirstVisit: 30,
    admission: { kind: "day" as const, category: "adult" as const, dates },
  };
}

function input(
  selection: Partial<Selection>,
  expectedTotalCents: number,
  simulation: CheckoutInput["simulation"] = "success",
): CheckoutInput {
  return {
    booker,
    selection: {
      attendees: [],
      familyGroups: [],
      extras: { sticksPairs: 0, dinners: [], workshops: [] },
      ...selection,
    },
    expectedTotalCents,
    simulation,
  };
}

const adultWithSticks = input(
  {
    attendees: [adult("a", ["2026-11-10"])],
    extras: { sticksPairs: 1, dinners: [], workshops: [] },
  },
  2000,
);

function workshopPair(prefix: string): CheckoutInput {
  return input(
    {
      attendees: [
        adult(`${prefix}1`, ["2026-11-11"]),
        adult(`${prefix}2`, ["2026-11-11"]),
      ],
      extras: {
        sticksPairs: 0,
        dinners: [],
        workshops: [
          { attendeeId: `${prefix}1`, date: "2026-11-11" },
          { attendeeId: `${prefix}2`, date: "2026-11-11" },
        ],
      },
    },
    2 * 1500 + 2 * 2000,
  );
}

describe("checkout against PostgreSQL", () => {
  it("saves a booking, deducts its stock and reopens it by receipt token", async () => {
    const result = await checkout(pool, randomUUID(), adultWithSticks);

    expect(result.kind).toBe("created");
    expect(await stock("day_adult")).toBe(379);
    expect(await stock("dandiya_sticks")).toBe(899);

    if (result.kind !== "created") return;
    const token = result.booking.receiptPath.replace("/confirmation/", "");
    const saved = await findBookingByToken(pool, token);
    expect(saved?.id).toBe(result.booking.bookingId);
    expect(saved?.paymentMode).toBe("simulated");
  });

  it("returns the same booking for a retried key and deducts stock once", async () => {
    const key = randomUUID();
    const first = await checkout(pool, key, adultWithSticks);
    const second = await checkout(pool, key, adultWithSticks);

    expect(first.kind).toBe("created");
    expect(second.kind).toBe("replayed");
    if (first.kind !== "created" || second.kind !== "replayed") return;
    expect(second.booking).toEqual(first.booking);
    expect(await stock("day_adult")).toBe(379);
    expect(await bookingCount()).toBe(1);
  });

  it("books once when the same key arrives twice at the same time (double-click)", async () => {
    const key = randomUUID();
    const results = await Promise.all([
      checkout(pool, key, adultWithSticks),
      checkout(pool, key, adultWithSticks),
    ]);

    expect(results.map((r) => r.kind).sort()).toEqual(["created", "replayed"]);
    expect(await bookingCount()).toBe(1);
    expect(await stock("day_adult")).toBe(379);
  });

  it("rejects a reused key with different booking details", async () => {
    const key = randomUUID();
    await checkout(pool, key, adultWithSticks);
    const reused = await checkout(pool, key, {
      ...adultWithSticks,
      booker: { ...booker, name: "Someone else" },
    });

    expect(reused.kind).toBe("key_conflict");
    expect(await bookingCount()).toBe(1);
  });

  it("lets only one of two competing bookings take the last two workshop places", async () => {
    const results = await Promise.all([
      checkout(pool, randomUUID(), workshopPair("x")),
      checkout(pool, randomUUID(), workshopPair("y")),
    ]);

    expect(results.map((r) => r.kind).sort()).toEqual([
      "created",
      "out_of_stock",
    ]);
    expect(await stock("garba_workshop")).toBe(0);
    expect(await stock("day_adult")).toBe(378);
    expect(await bookingCount()).toBe(1);
  });

  it("rolls back every deduction when one product is short", async () => {
    await pool.query(
      "UPDATE inventory SET remaining = 1 WHERE product_id = 'garba_workshop'",
    );
    const result = await checkout(pool, randomUUID(), workshopPair("z"));

    expect(result).toEqual({
      kind: "out_of_stock",
      productIds: ["garba_workshop"],
    });
    expect(await stock("garba_workshop")).toBe(1);
    expect(await stock("day_adult")).toBe(380);
    expect(await bookingCount()).toBe(0);
  });

  it("refuses the sold-out Adult All-Day Pass", async () => {
    const result = await checkout(
      pool,
      randomUUID(),
      input(
        {
          attendees: [
            {
              id: "a",
              name: "Adult",
              firstVisitDate: "2026-11-10",
              ageAtFirstVisit: 30,
              admission: { kind: "all_days", category: "adult" },
            },
          ],
        },
        6000,
      ),
    );

    expect(result).toEqual({
      kind: "out_of_stock",
      productIds: ["all_days_adult"],
    });
  });

  it("consumes no stock when the simulated payment is declined, and the same key can then succeed", async () => {
    const key = randomUUID();
    const declined = await checkout(pool, key, {
      ...adultWithSticks,
      simulation: "decline",
    });

    expect(declined.kind).toBe("declined");
    expect(await stock("day_adult")).toBe(380);
    expect(await bookingCount()).toBe(0);

    const retried = await checkout(pool, key, adultWithSticks);
    expect(retried.kind).toBe("created");
  });

  it("asks for review when the reviewed total no longer matches", async () => {
    const result = await checkout(pool, randomUUID(), {
      ...adultWithSticks,
      expectedTotalCents: 1500,
    });

    expect(result.kind).toBe("price_changed");
    if (result.kind === "price_changed") {
      expect(result.quote.totalCents).toBe(2000);
    }
    expect(await stock("day_adult")).toBe(380);
  });

  it("saves a valid $0 booking as free and still deducts its stock", async () => {
    const free = input(
      {
        attendees: [adult("a", ["2026-11-10"])],
        extras: { sticksPairs: 1, dinners: [], workshops: [] },
        promoCode: "FLAT20",
      },
      0,
      "decline",
    );
    const result = await checkout(pool, randomUUID(), free);

    expect(result.kind).toBe("created");
    expect(await stock("day_adult")).toBe(379);
    expect(await stock("dandiya_sticks")).toBe(899);
    if (result.kind === "created") {
      const token = result.booking.receiptPath.replace("/confirmation/", "");
      expect((await findBookingByToken(pool, token))?.paymentMode).toBe("free");
    }
  });

  it("rejects an invalid booker without touching stock", async () => {
    const result = await checkout(pool, randomUUID(), {
      ...adultWithSticks,
      booker: { ...booker, age: 17 },
    });

    expect(result).toEqual({
      kind: "invalid",
      fields: [
        {
          path: "booker.age",
          message: "The person booking must be 18 or older.",
        },
      ],
    });
    expect(await stock("day_adult")).toBe(380);
  });
});
