import { createHash, randomBytes, randomInt } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { countUnits } from "@/domain/booking/inventory";
import {
  PRODUCT_IDS,
  type Booker,
  type ProductId,
  type Quote,
  type Selection,
} from "@/domain/booking/types";
import { validateBooker } from "@/domain/booking/validation";
import {
  claimRequestKey,
  deductStock,
  findBookingById,
  insertBooking,
  linkRequestToBooking,
  type PaymentMode,
} from "./booking-repository";
import type { FieldError } from "./http-errors";
import { quoteSelection } from "./quote-service";
import { quoteSchema } from "./schemas";

export interface CheckoutInput {
  booker: Booker;
  selection: Selection;
  expectedTotalCents: number;
  simulation: "success" | "decline";
}

export interface ConfirmedBooking {
  bookingId: string;
  receiptPath: string;
  quote: Quote;
}

export type CheckoutResult =
  | { kind: "created"; booking: ConfirmedBooking }
  | { kind: "replayed"; booking: ConfirmedBooking }
  | { kind: "invalid"; fields: FieldError[] }
  | { kind: "price_changed"; quote: Quote }
  | { kind: "out_of_stock"; productIds: ProductId[] }
  | { kind: "declined" }
  | { kind: "key_conflict" };

export async function checkout(
  pool: Pool,
  idempotencyKey: string,
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const claim = await claimRequestKey(client, idempotencyKey, fingerprint);
    if (!claim.claimed) {
      const saved =
        claim.fingerprint === fingerprint && claim.bookingId !== null
          ? await findBookingById(client, claim.bookingId)
          : null;
      await client.query("ROLLBACK");
      return saved === null
        ? { kind: "key_conflict" }
        : {
            kind: "replayed",
            booking: {
              bookingId: saved.id,
              receiptPath: receiptPath(saved.receiptToken),
              quote: quoteSchema.parse(saved.quote),
            },
          };
    }

    const result = await createBooking(client, idempotencyKey, input);
    await client.query(result.kind === "created" ? "COMMIT" : "ROLLBACK");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

async function createBooking(
  client: PoolClient,
  idempotencyKey: string,
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const bookerFields = validateBooker(input.booker).map(
    ({ path, message }) => ({ path: `booker.${path}`, message }),
  );
  const quoted = quoteSelection(input.selection);
  const fields = [...bookerFields, ...(quoted.ok ? [] : quoted.fields)];
  if (!quoted.ok || fields.length > 0) {
    return { kind: "invalid", fields };
  }

  const { quote } = quoted;
  if (quote.totalCents !== input.expectedTotalCents) {
    return { kind: "price_changed", quote };
  }

  const paymentMode: PaymentMode =
    quote.totalCents === 0 ? "free" : "simulated";
  if (paymentMode === "simulated" && input.simulation === "decline") {
    return { kind: "declined" };
  }

  // A fixed product order keeps concurrent checkouts from deadlocking on stock rows.
  const units = countUnits(input.selection);
  const shortages: ProductId[] = [];
  for (const productId of [...PRODUCT_IDS].sort()) {
    if (units[productId] > 0) {
      const ok = await deductStock(client, productId, units[productId]);
      if (!ok) shortages.push(productId);
    }
  }
  if (shortages.length > 0) {
    return { kind: "out_of_stock", productIds: shortages };
  }

  const booking = {
    id: newBookingReference(),
    receiptToken: randomBytes(32).toString("base64url"),
    booker: input.booker,
    selection: input.selection,
    quote,
    paymentMode,
  };
  await insertBooking(client, booking);
  await linkRequestToBooking(client, idempotencyKey, booking.id);

  return {
    kind: "created",
    booking: {
      bookingId: booking.id,
      receiptPath: receiptPath(booking.receiptToken),
      quote,
    },
  };
}

export function receiptPath(token: string): string {
  return `/confirmation/${token}`;
}

// Unambiguous characters only (no 0/O or 1/I), e.g. "SU-7KQ2M9XA".
function newBookingReference(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let reference = "SU-";
  for (let i = 0; i < 8; i += 1) {
    reference += alphabet[randomInt(alphabet.length)];
  }
  return reference;
}
