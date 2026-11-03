import { errorResponse, NO_STORE, zodFieldErrors } from "@/server/http-errors";
import { quoteSelection } from "@/server/quote-service";
import { quoteRequestSchema } from "@/server/schemas";

export async function POST(request: Request) {
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

  const parsed = quoteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(
      400,
      "invalid_request",
      "The request is not in the expected shape.",
      zodFieldErrors(parsed.error),
    );
  }

  const result = quoteSelection(parsed.data.selection);
  if (!result.ok) {
    return errorResponse(
      422,
      "invalid_selection",
      "Some booking details need fixing.",
      result.fields,
    );
  }

  return Response.json(result.quote, { headers: NO_STORE });
}
