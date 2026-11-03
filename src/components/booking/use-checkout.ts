"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import {
  classifyCheckout,
  clearPending,
  CHECKOUT_STORAGE_KEY,
  CHECKOUT_TIMEOUT_MS,
  readPending,
  sessionStorageOrNull,
  writePending,
  type CheckoutRejection,
  type PendingCheckout,
} from "./checkout-attempt";

export type CheckoutPhase = "idle" | "submitting" | "uncertain";

const listeners = new Set<() => void>();
const UNAVAILABLE_SNAPSHOT = "\u0000unavailable";

function notifyStorage() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function readSnapshot(): string {
  try {
    return globalThis.sessionStorage?.getItem(CHECKOUT_STORAGE_KEY) ?? "";
  } catch {
    return UNAVAILABLE_SNAPSHOT;
  }
}

export function useCheckout() {
  const router = useRouter();
  const snapshot = useSyncExternalStore(subscribe, readSnapshot, () => "");
  const stored =
    snapshot === UNAVAILABLE_SNAPSHOT
      ? readPending(null)
      : readPending({
          length: 0,
          clear() {},
          key: () => null,
          getItem: (key) =>
            key === CHECKOUT_STORAGE_KEY ? snapshot || null : null,
          setItem() {},
          removeItem() {},
        });
  const [phase, setPhase] = useState<CheckoutPhase>("idle");
  const [localAttempt, setLocalAttempt] = useState<PendingCheckout | null>(
    null,
  );
  const [rejection, setRejection] = useState<CheckoutRejection | null>(null);
  const [writeWarning, setWriteWarning] = useState(false);

  const attempt: PendingCheckout | null =
    stored.status === "pending" ? stored.attempt : localAttempt;
  const effectivePhase: CheckoutPhase =
    phase === "idle" && attempt !== null ? "uncertain" : phase;
  const storageNote = writeWarning
    ? "This browser can't remember a checkout across a reload. Stay on this page until you see the confirmation."
    : stored.status === "corrupt"
      ? "The saved checkout attempt couldn't be read. If you already finished, open the receipt link from before the reload."
      : stored.status === "unavailable"
        ? "This browser can't remember a checkout across a reload. Stay on this page until you see the confirmation."
        : null;

  async function submit(
    content: string,
  ): Promise<
    { kind: "confirmed" } | { kind: "uncertain" } | CheckoutRejection
  > {
    if (effectivePhase === "submitting") return { kind: "uncertain" };
    const storage = sessionStorageOrNull();
    const next: PendingCheckout =
      effectivePhase === "uncertain" && attempt !== null
        ? attempt
        : attempt !== null && attempt.content === content
          ? attempt
          : { key: crypto.randomUUID(), content };
    if (!writePending(storage, next).ok) setWriteWarning(true);
    setLocalAttempt(next);
    notifyStorage();
    setPhase("submitting");
    setRejection(null);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": next.key,
        },
        body: next.content,
        signal: AbortSignal.timeout(CHECKOUT_TIMEOUT_MS),
      });
      const body: unknown = await response.json().catch(() => null);
      const result = classifyCheckout(response.status, body);
      if (result.kind === "confirmed") {
        clearPending(storage);
        notifyStorage();
        setLocalAttempt(null);
        setPhase("idle");
        router.push(result.receiptPath);
        return { kind: "confirmed" };
      }
      if (result.kind === "uncertain") {
        setPhase("uncertain");
        return result;
      }
      clearPending(storage);
      notifyStorage();
      setLocalAttempt(null);
      setPhase("idle");
      setRejection(result);
      return result;
    } catch {
      setPhase("uncertain");
      return { kind: "uncertain" };
    }
  }

  return {
    phase: effectivePhase,
    rejection,
    storageNote,
    restored: attempt !== null && phase !== "submitting",
    locked: effectivePhase !== "idle",
    submit,
  };
}
