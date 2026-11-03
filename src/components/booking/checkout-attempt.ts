import {
  apiErrorSchema,
  checkoutSuccessSchema,
} from "@/domain/booking/responses";
import type { ProductId } from "@/domain/booking/types";
import type { ApiFieldError } from "./use-quote";

export const CHECKOUT_STORAGE_KEY = "jkyog-pending-checkout";
export const CHECKOUT_TIMEOUT_MS = 20_000;

export interface PendingCheckout {
  key: string;
  content: string;
}

export interface CheckoutRejection {
  kind: "rejected";
  code: string;
  message: string;
  fields: ApiFieldError[];
  productIds: ProductId[];
}

export type CheckoutClassification =
  | { kind: "confirmed"; receiptPath: string }
  | { kind: "uncertain" }
  | CheckoutRejection;

const DEFINITE_REJECTION = new Set([400, 402, 409, 422]);

export function classifyCheckout(
  status: number,
  body: unknown,
): CheckoutClassification {
  if (status === 200 || status === 201) {
    const parsed = checkoutSuccessSchema.safeParse(body);
    return parsed.success
      ? { kind: "confirmed", receiptPath: parsed.data.receiptPath }
      : { kind: "uncertain" };
  }
  if (!DEFINITE_REJECTION.has(status)) return { kind: "uncertain" };

  const parsed = apiErrorSchema.safeParse(body);
  if (!parsed.success) return { kind: "uncertain" };
  return {
    kind: "rejected",
    code: parsed.data.error.code,
    message: parsed.data.error.message,
    fields: parsed.data.error.fields,
    productIds: parsed.data.error.productIds ?? [],
  };
}

export type PendingRead =
  | { status: "empty" }
  | { status: "pending"; attempt: PendingCheckout }
  | { status: "corrupt" }
  | { status: "unavailable" };

export function readPending(storage: Storage | null): PendingRead {
  if (storage === null) return { status: "unavailable" };
  let raw: string | null;
  try {
    raw = storage.getItem(CHECKOUT_STORAGE_KEY);
  } catch {
    return { status: "unavailable" };
  }
  if (raw === null) return { status: "empty" };
  try {
    const parsed = JSON.parse(raw) as Partial<PendingCheckout>;
    if (
      typeof parsed.key === "string" &&
      /^[A-Za-z0-9_-]{16,128}$/.test(parsed.key) &&
      typeof parsed.content === "string" &&
      parsed.content.startsWith("{")
    ) {
      return {
        status: "pending",
        attempt: { key: parsed.key, content: parsed.content },
      };
    }
  } catch {
    return { status: "corrupt" };
  }
  return { status: "corrupt" };
}

export function writePending(
  storage: Storage | null,
  attempt: PendingCheckout,
): { ok: true } | { ok: false } {
  if (storage === null) return { ok: false };
  try {
    storage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(attempt));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export function clearPending(storage: Storage | null): void {
  if (storage === null) return;
  try {
    storage.removeItem(CHECKOUT_STORAGE_KEY);
  } catch {
    // The in-memory attempt is still cleared by the caller.
  }
}

export function sessionStorageOrNull(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}
