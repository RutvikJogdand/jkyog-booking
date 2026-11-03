import type { ZodError } from "zod";

export interface FieldError {
  path: string;
  message: string;
}

export const NO_STORE = { "Cache-Control": "no-store" } as const;

export function errorResponse(
  status: number,
  code: string,
  message: string,
  fields: readonly FieldError[] = [],
  productIds?: readonly string[],
): Response {
  return Response.json(
    {
      error: {
        code,
        message,
        fields,
        ...(productIds === undefined ? {} : { productIds }),
      },
    },
    { status, headers: NO_STORE },
  );
}

export function zodFieldErrors(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}
