"use client";

import { useState } from "react";
import styles from "./booking.module.css";
import { formatUsd } from "./format";
import { QuoteTable } from "./QuoteTable";
import type { QuoteState } from "./use-quote";

export function OrderSummary({
  quote,
  promoCode,
  hasAttendees,
}: {
  quote: QuoteState;
  promoCode: string | null;
  hasAttendees: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const current = quote.status === "ready" ? quote.quote : null;
  const statusText = !hasAttendees
    ? "Add the first person who's coming to see a price."
    : quote.status === "loading"
      ? "Updating total…"
      : quote.status === "idle"
        ? "Finish each person's details to see a price."
        : quote.status === "error"
          ? (quote.error?.message ?? "We couldn't update the total.")
          : "";

  return (
    <aside
      className={`${styles.card} ${styles.summary} no-print`}
      aria-labelledby="summary-heading"
    >
      <div className={styles.summaryBar}>
        <h2 id="summary-heading">Order summary</h2>
        <span className={styles.summaryTotal}>
          {current ? formatUsd(current.totalCents) : "—"}
        </span>
        <button
          type="button"
          className={`${styles.linkButton} ${styles.summaryToggle}`}
          aria-expanded={expanded}
          aria-controls="summary-body"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Hide summary" : "View summary"}
        </button>
      </div>
      <p className={styles.summaryStatus} aria-live="polite">
        {statusText}
      </p>

      <div id="summary-body" className={styles.summaryBody} hidden={!expanded}>
        <p className={styles.hint}>
          The server calculates this total. No real payment is collected.
        </p>
        {quote.status === "error" && quote.error && (
          <div className={styles.error} role="alert">
            <strong>Error:</strong> {quote.error.message}
            <ul>
              {quote.error.fields.slice(0, 3).map((field) => (
                <li key={`${field.path}${field.message}`}>{field.message}</li>
              ))}
            </ul>
            <button
              type="button"
              className={styles.linkButton}
              onClick={quote.retry}
            >
              Try again
            </button>
          </div>
        )}

        {current && (
          <QuoteTable
            quote={current}
            promoCode={promoCode}
            caption="Order summary"
          />
        )}

        {!current &&
          quote.status === "loading" &&
          quote.lastQuote &&
          hasAttendees && (
            <div className={styles.stale}>
              <p className={styles.muted}>
                Previous total: {formatUsd(quote.lastQuote.totalCents)}. It does
                not include the latest change.
              </p>
            </div>
          )}
      </div>
    </aside>
  );
}
