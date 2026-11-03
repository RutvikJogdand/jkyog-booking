import type { Pool, PoolClient } from "pg";
import type {
  Booker,
  ProductId,
  Quote,
  Selection,
} from "@/domain/booking/types";

type Db = Pool | PoolClient;

export type PaymentMode = "simulated" | "free";

export interface BookingRow {
  id: string;
  receiptToken: string;
  selection: unknown;
  quote: unknown;
  paymentMode: PaymentMode;
  createdAt: Date;
}

export async function getAvailability(db: Db): Promise<Map<string, number>> {
  const { rows } = await db.query<{ product_id: string; remaining: number }>(
    "SELECT product_id, remaining FROM inventory",
  );
  return new Map(rows.map((row) => [row.product_id, row.remaining]));
}

export type KeyClaim =
  | { claimed: true }
  | { claimed: false; fingerprint: string; bookingId: string | null };

// Concurrent claims of the same key wait here until the first transaction ends.
export async function claimRequestKey(
  client: PoolClient,
  key: string,
  fingerprint: string,
): Promise<KeyClaim> {
  const inserted = await client.query(
    `INSERT INTO booking_requests (idempotency_key, fingerprint)
     VALUES ($1, $2)
     ON CONFLICT (idempotency_key) DO NOTHING`,
    [key, fingerprint],
  );
  if (inserted.rowCount === 1) {
    return { claimed: true };
  }

  const { rows } = await client.query<{
    fingerprint: string;
    booking_id: string | null;
  }>(
    "SELECT fingerprint, booking_id FROM booking_requests WHERE idempotency_key = $1",
    [key],
  );
  const row = rows[0];
  return {
    claimed: false,
    fingerprint: row?.fingerprint ?? "",
    bookingId: row?.booking_id ?? null,
  };
}

// Returns false, changing nothing, when fewer than `units` remain.
export async function deductStock(
  client: PoolClient,
  productId: ProductId,
  units: number,
): Promise<boolean> {
  const result = await client.query(
    `UPDATE inventory SET remaining = remaining - $2
     WHERE product_id = $1 AND remaining >= $2`,
    [productId, units],
  );
  return result.rowCount === 1;
}

export async function insertBooking(
  client: PoolClient,
  booking: {
    id: string;
    receiptToken: string;
    booker: Booker;
    selection: Selection;
    quote: Quote;
    paymentMode: PaymentMode;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO bookings (id, receipt_token, booker, selection, quote, payment_mode)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      booking.id,
      booking.receiptToken,
      JSON.stringify(booking.booker),
      JSON.stringify(booking.selection),
      JSON.stringify(booking.quote),
      booking.paymentMode,
    ],
  );
}

export async function linkRequestToBooking(
  client: PoolClient,
  key: string,
  bookingId: string,
): Promise<void> {
  await client.query(
    "UPDATE booking_requests SET booking_id = $2 WHERE idempotency_key = $1",
    [key, bookingId],
  );
}

const BOOKING_COLUMNS = `id, receipt_token, selection, quote, payment_mode, created_at`;

interface RawBookingRow {
  id: string;
  receipt_token: string;
  selection: unknown;
  quote: unknown;
  payment_mode: PaymentMode;
  created_at: Date;
}

function toBookingRow(row: RawBookingRow): BookingRow {
  return {
    id: row.id,
    receiptToken: row.receipt_token,
    selection: row.selection,
    quote: row.quote,
    paymentMode: row.payment_mode,
    createdAt: row.created_at,
  };
}

export async function findBookingById(
  db: Db,
  id: string,
): Promise<BookingRow | null> {
  const { rows } = await db.query<RawBookingRow>(
    `SELECT ${BOOKING_COLUMNS} FROM bookings WHERE id = $1`,
    [id],
  );
  return rows[0] ? toBookingRow(rows[0]) : null;
}

export async function findBookingByToken(
  db: Db,
  token: string,
): Promise<BookingRow | null> {
  const { rows } = await db.query<RawBookingRow>(
    `SELECT ${BOOKING_COLUMNS} FROM bookings WHERE receipt_token = $1`,
    [token],
  );
  return rows[0] ? toBookingRow(rows[0]) : null;
}
