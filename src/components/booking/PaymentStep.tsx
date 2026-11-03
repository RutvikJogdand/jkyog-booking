"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { Booker, Quote, Selection } from "@/domain/booking/types";
import styles from "./booking.module.css";
import { formatUsd } from "./format";
import type { ApiFieldError } from "./use-quote";

interface Props {
  booker: Booker;
  selection: Selection;
  quote: Quote;
  onPriceChanged: () => void;
  onStockChanged: () => void;
}

type Outcome =
  | { kind: "rejected"; message: string; fields: ApiFieldError[] }
  | { kind: "uncertain" };

export function PaymentStep({
  booker,
  selection,
  quote,
  onPriceChanged,
  onStockChanged,
}: Props) {
  const router = useRouter();
  const [simulation, setSimulation] = useState<"success" | "decline">(
    "success",
  );
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  // One key per exact submitted content: retries after a timeout reuse it, so the
  // server returns the original booking instead of booking twice.
  const pending = useRef<{ content: string; key: string } | null>(null);
  const isFree = quote.totalCents === 0;

  async function submit() {
    const content = JSON.stringify({
      booker,
      selection,
      expectedTotalCents: quote.totalCents,
      simulation: isFree ? "success" : simulation,
    });
    if (pending.current?.content !== content) {
      pending.current = { content, key: crypto.randomUUID() };
    }
    setSubmitting(true);
    setOutcome(null);

    let response: Response;
    try {
      response = await fetch("/api/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": pending.current.key,
        },
        body: content,
      });
    } catch {
      setOutcome({ kind: "uncertain" });
      setSubmitting(false);
      return;
    }

    const body = (await response.json().catch(() => null)) as {
      receiptPath?: string;
      error?: { code: string; message: string; fields: ApiFieldError[] };
    } | null;

    if (
      (response.status === 201 || response.status === 200) &&
      body?.receiptPath
    ) {
      router.push(body.receiptPath);
      return;
    }
    if (response.status >= 500 || body === null) {
      setOutcome({ kind: "uncertain" });
      setSubmitting(false);
      return;
    }

    pending.current = null;
    setSubmitting(false);
    setOutcome({
      kind: "rejected",
      message: body.error?.message ?? "The booking couldn't be completed.",
      fields: body.error?.fields ?? [],
    });
    if (body.error?.code === "price_changed") onPriceChanged();
    if (body.error?.code === "out_of_stock") onStockChanged();
  }

  return (
    <section className={styles.card} aria-labelledby="payment-title">
      <h2 id="payment-title">Payment</h2>
      <p className={styles.banner}>
        Demo payment. No card details are collected and no real money is
        charged.
      </p>

      <p className={styles.ticketLine}>Total: {formatUsd(quote.totalCents)}</p>

      {!isFree && (
        <fieldset className={styles.fieldset}>
          <legend>Simulated result</legend>
          <div className={styles.options}>
            <label className={styles.option}>
              <input
                type="radio"
                name="simulation"
                checked={simulation === "success"}
                onChange={() => setSimulation("success")}
              />
              Payment succeeds
            </label>
            <label className={styles.option}>
              <input
                type="radio"
                name="simulation"
                checked={simulation === "decline"}
                onChange={() => setSimulation("decline")}
              />
              Payment is declined
            </label>
          </div>
        </fieldset>
      )}

      <div aria-live="polite">
        {outcome?.kind === "rejected" && (
          <div className={styles.error} role="alert">
            <strong>Error:</strong> {outcome.message}
            {outcome.fields.length > 0 && (
              <ul>
                {outcome.fields.map((f) => (
                  <li key={`${f.path}${f.message}`}>{f.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {outcome?.kind === "uncertain" && (
          <div className={styles.error} role="alert">
            <strong>Error:</strong> We couldn&apos;t confirm whether your
            booking went through. Retrying is safe — you won&apos;t be booked
            twice.
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={submitting}
          onClick={() => void submit()}
        >
          {submitting
            ? "Processing…"
            : outcome?.kind === "uncertain"
              ? "Retry"
              : isFree
                ? "Confirm free booking"
                : `Pay ${formatUsd(quote.totalCents)} (simulated)`}
        </button>
      </div>
    </section>
  );
}
