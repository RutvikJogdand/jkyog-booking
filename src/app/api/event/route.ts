import { PRODUCT_IDS } from "@/domain/booking/types";
import { getAvailability } from "@/server/booking-repository";
import { EVENT, PRICES } from "@/server/catalog";
import { getPool } from "@/server/db";
import { errorResponse, NO_STORE } from "@/server/http-errors";

export async function GET() {
  let stock: Map<string, number>;
  try {
    stock = await getAvailability(getPool());
  } catch (error) {
    console.error(
      "Loading availability failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return errorResponse(
      503,
      "database_unavailable",
      "Festival details are temporarily unavailable. Please try again.",
    );
  }

  return Response.json(
    {
      event: EVENT,
      products: PRODUCT_IDS.map((id) => ({ id, ...PRICES[id] })),
      availability: Object.fromEntries(
        PRODUCT_IDS.map((id) => [id, stock.get(id) ?? 0]),
      ),
    },
    { headers: NO_STORE },
  );
}
