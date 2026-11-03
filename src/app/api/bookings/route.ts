import { checkout } from "@/server/booking-service";
import { PRICES } from "@/server/catalog";
import { getPool } from "@/server/db";
import { errorResponse, NO_STORE, zodFieldErrors } from "@/server/http-errors";
import { checkoutRequestSchema, idempotencyKeySchema } from "@/server/schemas";

export async function POST(request: Request) {
  const key = idempotencyKeySchema.safeParse(
    request.headers.get("Idempotency-Key"),
  );
  if (!key.success) {
    return errorResponse(
      400,
      "invalid_idempotency_key",
      "Send an Idempotency-Key header of 16–128 letters, digits, - or _.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(
      400,
      "invalid_json",
      "The request body must be valid JSON.",
    );
  }

  const parsed = checkoutRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      400,
      "invalid_request",
      "The request is not in the expected shape.",
      zodFieldErrors(parsed.error),
    );
  }

  let result: Awaited<ReturnType<typeof checkout>>;
  try {
    result = await checkout(getPool(), key.data, parsed.data);
  } catch (error) {
    console.error(
      "Checkout failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return errorResponse(
      503,
      "database_unavailable",
      "We couldn't confirm the booking. Retrying is safe: you won't be booked twice.",
    );
  }

  switch (result.kind) {
    case "created":
      return Response.json(result.booking, { status: 201, headers: NO_STORE });
    case "replayed":
      return Response.json(result.booking, { status: 200, headers: NO_STORE });
    case "invalid":
      return errorResponse(
        422,
        "invalid_selection",
        "Some booking details need fixing.",
        result.fields,
      );
    case "price_changed":
      return errorResponse(
        409,
        "price_changed",
        `The total is now ${formatUsd(result.quote.totalCents)}. Please review it before confirming.`,
      );
    case "out_of_stock":
      return errorResponse(
        409,
        "out_of_stock",
        `Not enough left: ${result.productIds.map((id) => PRICES[id].name).join(", ")}. Please change your selection.`,
      );
    case "declined":
      return errorResponse(
        402,
        "payment_declined",
        "Payment declined (simulated). Nothing was charged and no tickets were reserved.",
      );
    case "key_conflict":
      return errorResponse(
        409,
        "idempotency_key_reused",
        "This checkout key was already used for different booking details. Start a new checkout.",
      );
  }
}

function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
