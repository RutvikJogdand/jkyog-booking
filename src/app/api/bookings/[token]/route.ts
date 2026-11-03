import { findBookingByToken } from "@/server/booking-repository";
import { getPool } from "@/server/db";
import { errorResponse } from "@/server/http-errors";
import { quoteSchema, selectionSchema } from "@/server/schemas";

const RECEIPT_HEADERS = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex",
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    return notFound();
  }

  let booking: Awaited<ReturnType<typeof findBookingByToken>>;
  try {
    booking = await findBookingByToken(getPool(), token);
  } catch (error) {
    console.error(
      "Loading receipt failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return errorResponse(
      503,
      "database_unavailable",
      "This booking is temporarily unavailable. Please try again.",
    );
  }
  if (booking === null) {
    return notFound();
  }

  const selection = selectionSchema.parse(booking.selection);
  return Response.json(
    {
      bookingId: booking.id,
      attendees: selection.attendees,
      familyGroups: selection.familyGroups,
      extras: selection.extras,
      promoCode: selection.promoCode ?? null,
      quote: quoteSchema.parse(booking.quote),
      createdAt: booking.createdAt.toISOString(),
      paymentMode: booking.paymentMode,
    },
    { headers: RECEIPT_HEADERS },
  );
}

function notFound(): Response {
  return Response.json(
    {
      error: {
        code: "not_found",
        message: "We couldn't find this booking. Check the link.",
        fields: [],
      },
    },
    { status: 404, headers: RECEIPT_HEADERS },
  );
}
