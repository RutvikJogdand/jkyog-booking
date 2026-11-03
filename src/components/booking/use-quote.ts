"use client";

import { useEffect, useState } from "react";
import type { Quote, Selection } from "@/domain/booking/types";

export interface ApiFieldError {
  path: string;
  message: string;
}

export type QuoteOutcome =
  | { ok: true; quote: Quote }
  | { ok: false; message: string; fields: ApiFieldError[] };

export interface QuoteState {
  status: "idle" | "loading" | "ready" | "error";
  quote: Quote | null;
  lastQuote: Quote | null;
  error: { message: string; fields: ApiFieldError[] } | null;
  retry: () => void;
}

export async function requestQuote(
  selection: Selection,
  signal?: AbortSignal,
): Promise<QuoteOutcome> {
  try {
    const response = await fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selection }),
      signal,
    });
    const body: unknown = await response.json();
    if (response.ok) {
      return { ok: true, quote: body as Quote };
    }
    const error = (
      body as { error?: { message: string; fields: ApiFieldError[] } }
    ).error;
    return {
      ok: false,
      message: error?.message ?? "We couldn't update the total.",
      fields: error?.fields ?? [],
    };
  } catch (error) {
    if (signal?.aborted) throw error;
    return { ok: false, message: "We couldn't update the total.", fields: [] };
  }
}

// Results are stored with the selection they answer, so a late response for an older
// selection can never be shown for the current one.
export function useQuote(selection: Selection | null): QuoteState {
  const key = selection === null ? null : JSON.stringify(selection);
  const [result, setResult] = useState<{
    key: string;
    outcome: QuoteOutcome;
  } | null>(null);
  const [lastQuote, setLastQuote] = useState<Quote | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      requestQuote(JSON.parse(key) as Selection, controller.signal)
        .then((outcome) => {
          setResult({ key, outcome });
          if (outcome.ok) setLastQuote(outcome.quote);
        })
        .catch(() => undefined);
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [key, attempt]);

  const current = key !== null && result?.key === key ? result.outcome : null;
  return {
    status:
      key === null
        ? "idle"
        : current === null
          ? "loading"
          : current.ok
            ? "ready"
            : "error",
    quote: current?.ok ? current.quote : null,
    lastQuote,
    error:
      current && !current.ok
        ? { message: current.message, fields: current.fields }
        : null,
    retry: () => {
      setResult(null);
      setAttempt((n) => n + 1);
    },
  };
}
