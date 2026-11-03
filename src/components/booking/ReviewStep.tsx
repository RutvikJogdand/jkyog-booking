"use client";

import { useEffect, useRef, useState, type Dispatch } from "react";
import type { Selection } from "@/domain/booking/types";
import type { Action, Draft } from "./booking-reducer";
import styles from "./booking.module.css";
import { DATE_LABELS, describeAdmission, formatUsd } from "./format";
import { QuoteTable } from "./QuoteTable";
import { requestQuote, type QuoteState } from "./use-quote";
import { TEXT_LIMITS } from "@/domain/booking/validation";

interface Props {
  draft: Draft;
  selection: Selection;
  quote: QuoteState;
  dispatch: Dispatch<Action>;
  goToStep: (step: 1 | 2) => void;
}

export function ReviewStep({
  draft,
  selection,
  quote,
  dispatch,
  goToStep,
}: Props) {
  const promoError = quote.error?.fields.find(
    (f) => f.path === "selection.promoCode",
  );

  return (
    <>
      <section className={styles.card} aria-labelledby="who-title">
        <h2 id="who-title">Who&apos;s coming</h2>
        <ul className={styles.peopleList}>
          {selection.attendees.map((attendee) => {
            const dinners = selection.extras.dinners.filter(
              (d) => d.attendeeId === attendee.id,
            );
            const workshops = selection.extras.workshops.filter(
              (w) => w.attendeeId === attendee.id,
            );
            return (
              <li key={attendee.id}>
                <strong>{attendee.name}</strong> (age {attendee.ageAtFirstVisit}{" "}
                on {DATE_LABELS[attendee.firstVisitDate]}):{" "}
                {describeAdmission(attendee, selection.familyGroups)}
                {dinners.length > 0 && (
                  <>
                    <br />
                    Dinner: {dinners.map((d) => DATE_LABELS[d.date]).join(", ")}
                  </>
                )}
                {workshops.length > 0 && (
                  <>
                    <br />
                    Garba Workshop:{" "}
                    {workshops.map((w) => DATE_LABELS[w.date]).join(", ")}
                  </>
                )}
              </li>
            );
          })}
        </ul>
        {selection.extras.sticksPairs > 0 && (
          <p>
            Dandiya Sticks: {selection.extras.sticksPairs}{" "}
            {selection.extras.sticksPairs === 1 ? "pair" : "pairs"}
          </p>
        )}
        <p>
          Booked by {draft.booker.name} ({draft.booker.email})
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => goToStep(1)}
          >
            Edit people and tickets
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => goToStep(2)}
          >
            Edit extras and contact
          </button>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="promo-title">
        <h2 id="promo-title">Promo code</h2>
        {draft.promoCode ? (
          <>
            <p
              className={
                quote.status === "ready" && !promoError
                  ? styles.success
                  : quote.status === "error"
                    ? styles.error
                    : undefined
              }
              role="status"
            >
              {quote.status === "loading" || quote.status === "idle" ? (
                <>Checking {draft.promoCode}…</>
              ) : promoError ? (
                <>
                  <strong>Error:</strong> {draft.promoCode}:{" "}
                  {promoError.message}
                </>
              ) : quote.status === "error" ? (
                <>
                  <strong>Error:</strong> We couldn&apos;t confirm{" "}
                  {draft.promoCode}.
                </>
              ) : (
                <>
                  Applied: <strong>{draft.promoCode}</strong>
                  {quote.quote
                    ? ` · saving ${formatUsd(quote.quote.discountCents)}`
                    : ""}
                </>
              )}
            </p>
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => dispatch({ type: "promoRemoved" })}
            >
              Remove code
            </button>
          </>
        ) : (
          <PromoForm
            selection={selection}
            onApplied={(code) => dispatch({ type: "promoApplied", code })}
          />
        )}
      </section>

      <section className={styles.card} aria-labelledby="price-title">
        <h2 id="price-title">Price</h2>
        {quote.status === "ready" && quote.quote ? (
          <QuoteTable
            quote={quote.quote}
            promoCode={draft.promoCode}
            caption="Itemized price"
          />
        ) : quote.status === "error" ? (
          <div className={styles.error} role="alert">
            <strong>Error:</strong> {quote.error?.message}
            {!promoError && (
              <>
                {" "}
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={quote.retry}
                >
                  Try again
                </button>
              </>
            )}
          </div>
        ) : (
          <p aria-live="polite">Updating total…</p>
        )}
      </section>
    </>
  );
}

function PromoForm({
  selection,
  onApplied,
}: {
  selection: Selection;
  onApplied: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => request.current?.abort();
  }, []);

  async function apply() {
    if (code.trim() === "") {
      setMessage("Enter a code.");
      return;
    }
    if (code.length > TEXT_LIMITS.promo) {
      setMessage(`Use ${TEXT_LIMITS.promo} characters or fewer.`);
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setMessage(null);
    try {
      const outcome = await requestQuote(
        { ...selection, promoCode: code },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setBusy(false);
      if (outcome.ok) {
        onApplied(code);
        return;
      }
      setMessage(
        outcome.fields.find((f) => f.path === "selection.promoCode")?.message ??
          outcome.message,
      );
    } catch {
      if (!controller.signal.aborted) {
        setBusy(false);
        setMessage("We couldn't check that code.");
      }
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void apply();
      }}
    >
      <div className={styles.field}>
        <label className={styles.label} htmlFor="promo">
          Code (optional)
        </label>
        <p className={styles.hint} id="promo-hint">
          One code per booking. Codes must match exactly, including capital
          letters.
        </p>
        <div className={styles.actions} style={{ marginTop: 0 }}>
          <input
            id="promo"
            className={styles.input}
            style={{ maxWidth: "14rem" }}
            aria-describedby={message ? "promo-hint promo-error" : "promo-hint"}
            aria-invalid={message !== null || undefined}
            maxLength={TEXT_LIMITS.promo}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button
            type="submit"
            className={styles.secondaryButton}
            disabled={busy}
          >
            {busy ? "Checking…" : "Apply"}
          </button>
        </div>
      </div>
      {message && (
        <p id="promo-error" className={styles.error} role="alert">
          <strong>Error:</strong> {message}
        </p>
      )}
    </form>
  );
}
