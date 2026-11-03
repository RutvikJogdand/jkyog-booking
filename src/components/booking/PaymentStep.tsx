"use client";

import type { Quote } from "@/domain/booking/types";
import styles from "./booking.module.css";
import { formatUsd } from "./format";
import type { CheckoutRejection } from "./checkout-attempt";

interface Props {
  quote: Quote;
  simulation: "success" | "decline";
  onSimulationChange: (value: "success" | "decline") => void;
  onPay: () => void;
  submitting: boolean;
  uncertain: boolean;
  rejection: CheckoutRejection | null;
  onOpenField: (path: string) => void;
}

export function PaymentStep({
  quote,
  simulation,
  onSimulationChange,
  onPay,
  submitting,
  uncertain,
  rejection,
  onOpenField,
}: Props) {
  const isFree = quote.totalCents === 0;
  const locked = submitting || uncertain;

  return (
    <section className={styles.card} aria-labelledby="payment-title">
      <h2 id="payment-title">Payment</h2>
      <p className={styles.banner}>
        Demo payment. No card details are collected and no real money is
        charged.
      </p>

      <p className={`${styles.ticketLine} ${styles.payTotal}`}>
        Total: {formatUsd(quote.totalCents)}
      </p>

      {!isFree && (
        <fieldset className={styles.fieldset} disabled={locked}>
          <legend>Simulated result</legend>
          <div className={styles.options}>
            <label className={styles.option}>
              <input
                type="radio"
                name="simulation"
                checked={simulation === "success"}
                onChange={() => onSimulationChange("success")}
              />
              Payment succeeds
            </label>
            <label className={styles.option}>
              <input
                type="radio"
                name="simulation"
                checked={simulation === "decline"}
                onChange={() => onSimulationChange("decline")}
              />
              Payment is declined
            </label>
          </div>
        </fieldset>
      )}

      <div aria-live="polite">
        {rejection && !locked && (
          <div className={styles.error} role="alert">
            <strong>Error:</strong> {rejection.message}
            {rejection.fields.length > 0 && (
              <ul>
                {rejection.fields.map((field) => (
                  <li key={`${field.path}${field.message}`}>
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => onOpenField(field.path)}
                    >
                      {field.message}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {uncertain && (
          <div className={styles.error} role="alert">
            <strong>Error:</strong> We couldn&apos;t confirm whether your
            booking went through. Retrying is safe — you won&apos;t be booked
            twice. The payment choice from this attempt stays the same.
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={submitting}
          onClick={onPay}
        >
          {submitting
            ? "Processing…"
            : uncertain
              ? "Retry the same checkout"
              : isFree
                ? "Confirm free booking"
                : `Pay ${formatUsd(quote.totalCents)} (simulated)`}
        </button>
      </div>
    </section>
  );
}
