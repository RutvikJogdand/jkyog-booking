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
  const shown = quote.quote ?? quote.lastQuote;

  return (
    <aside
      className={`${styles.card} ${styles.summary} no-print`}
      aria-labelledby="summary-heading"
    >
      <div className={styles.summaryBar}>
        <h2 id="summary-heading">Order summary</h2>
        <span className={styles.summaryTotal}>
          {shown ? formatUsd(shown.totalCents) : "—"}
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

      <div
        id="summary-body"
        className={styles.summaryBody}
        style={expanded ? undefined : { display: "none" }}
      >
        <p aria-live="polite" className={styles.muted}>
          {quote.status === "loading" && "Updating total…"}
          {quote.status === "idle" &&
            (hasAttendees
              ? "Finish each person's details to see a price."
              : "Add the first person who's coming to see a price.")}
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

        {shown && quote.status !== "idle" && (
          <div className={quote.status === "ready" ? undefined : styles.stale}>
            {quote.status !== "ready" && (
              <p className={styles.muted}>
                Out of date until the new total loads.
              </p>
            )}
            <QuoteTable
              quote={shown}
              promoCode={promoCode}
              caption="Order summary"
            />
          </div>
        )}
      </div>
    </aside>
  );
}
