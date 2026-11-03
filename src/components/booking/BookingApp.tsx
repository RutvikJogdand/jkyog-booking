"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { PRODUCT_IDS, type ProductId } from "@/domain/booking/types";
import { AttendeesStep } from "./AttendeesStep";
import {
  bookingReducer,
  initialDraft,
  toBooker,
  toSelection,
} from "./booking-reducer";
import styles from "./booking.module.css";
import { ExtrasStep } from "./ExtrasStep";
import { OrderSummary } from "./OrderSummary";
import { PaymentStep } from "./PaymentStep";
import { ReviewStep } from "./ReviewStep";
import {
  stepOneIssues,
  stepTwoIssues,
  type Availability,
  type ProductNames,
  type UiIssue,
} from "./step-checks";
import { useQuote } from "./use-quote";

type Step = 1 | 2 | 3 | 4;

interface EventData {
  event: { name: string; venue: string };
  products: { id: ProductId; name: string; unitPriceCents: number }[];
  availability: Availability;
}

const STEP_NAMES: Record<Step, string> = {
  1: "People and tickets",
  2: "Extras and contact",
  3: "Review",
  4: "Payment",
};

export function BookingApp() {
  const [eventData, setEventData] = useState<EventData | null>(null);
  const [eventFailed, setEventFailed] = useState(false);
  const [eventVersion, setEventVersion] = useState(0);
  const [draft, dispatch] = useReducer(bookingReducer, initialDraft);
  const [step, setStep] = useState<Step>(1);
  const [showIssues, setShowIssues] = useState<Record<Step, boolean>>({
    1: false,
    2: false,
    3: false,
    4: false,
  });
  const [stepMessage, setStepMessage] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/event", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("event failed");
        const data = (await response.json()) as EventData;
        if (!cancelled) {
          setEventData(data);
          setEventFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setEventFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [eventVersion]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const selection = toSelection(draft);
  const quote = useQuote(selection);

  if (eventData === null) {
    return (
      <main className={styles.page}>
        <Header />
        {eventFailed ? (
          <div className={styles.card} role="alert">
            <p>We couldn&apos;t load the festival details.</p>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                setEventFailed(false);
                setEventVersion((n) => n + 1);
              }}
            >
              Try again
            </button>
          </div>
        ) : (
          <div className={styles.card} aria-busy="true">
            <p>Loading festival details…</p>
          </div>
        )}
      </main>
    );
  }

  const prices = Object.fromEntries(
    eventData.products.map((p) => [p.id, p.unitPriceCents]),
  ) as Record<ProductId, number>;
  const names = Object.fromEntries(
    eventData.products.map((p) => [p.id, p.name]),
  ) as ProductNames;
  const availability = Object.fromEntries(
    PRODUCT_IDS.map((id) => [id, eventData.availability[id] ?? 0]),
  ) as Availability;

  const issuesByStep: Record<1 | 2, UiIssue[]> = {
    1: stepOneIssues(draft, selection, availability, names),
    2: stepTwoIssues(draft, selection, availability),
  };
  const canEnter = (target: Step): boolean => {
    if (target >= 2 && issuesByStep[1].length > 0) return false;
    if (target >= 3 && issuesByStep[2].length > 0) return false;
    if (target >= 4 && (quote.status !== "ready" || quote.quote === null))
      return false;
    return true;
  };

  function goTo(target: Step) {
    setStepMessage(null);
    setStep(target);
  }

  function next() {
    if (step === 1 || step === 2) {
      if (issuesByStep[step].length > 0) {
        setShowIssues((s) => ({ ...s, [step]: true }));
        document.getElementById("error-summary")?.focus();
        return;
      }
    }
    if (step === 3 && !canEnter(4)) {
      setStepMessage(
        quote.status === "loading"
          ? "Please wait for the total to finish updating."
          : "The price needs to load before you can pay. Fix any problems above or try again.",
      );
      return;
    }
    goTo((step + 1) as Step);
  }

  const visibleIssues =
    (step === 1 || step === 2) && showIssues[step] ? issuesByStep[step] : null;

  return (
    <main className={styles.page}>
      <Header />

      <div className={styles.layout}>
        <div>
          <nav aria-label="Booking steps">
            <ol className={styles.steps}>
              {([1, 2, 3, 4] as const).map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    className={`${styles.stepButton} ${s === step ? styles.stepCurrent : ""}`}
                    aria-current={s === step ? "step" : undefined}
                    disabled={s === step || s > step}
                    onClick={() => goTo(s)}
                  >
                    {s}. {STEP_NAMES[s]}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <h2 ref={headingRef} tabIndex={-1}>
            Step {step} of 4: {STEP_NAMES[step]}
          </h2>

          {draft.notices.map((notice, index) => (
            <div
              key={`${index}${notice}`}
              className={styles.notice}
              role="status"
            >
              <span>{notice}</span>
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => dispatch({ type: "noticeDismissed", index })}
              >
                Dismiss
              </button>
            </div>
          ))}

          {visibleIssues && visibleIssues.length > 0 && (
            <div
              id="error-summary"
              className={styles.errorSummary}
              role="alert"
              tabIndex={-1}
            >
              <h2>
                Please fix{" "}
                {visibleIssues.length === 1 ? "this problem" : "these problems"}
              </h2>
              <ul>
                {visibleIssues.map((issue) => (
                  <li key={`${issue.key}${issue.message}`}>
                    <a href={`#${anchorFor(issue.key)}`}>
                      {issue.label}: {issue.message}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === 1 && (
            <AttendeesStep
              draft={draft}
              dispatch={dispatch}
              issues={visibleIssues}
              availability={availability}
              prices={prices}
            />
          )}
          {step === 2 && (
            <ExtrasStep
              draft={draft}
              dispatch={dispatch}
              issues={visibleIssues}
              availability={availability}
              prices={prices}
            />
          )}
          {step === 3 && selection && (
            <ReviewStep
              draft={draft}
              selection={selection}
              quote={quote}
              dispatch={dispatch}
              goToStep={goTo}
            />
          )}
          {step === 4 && selection && quote.quote && (
            <PaymentStep
              booker={toBooker(draft.booker)}
              selection={selection}
              quote={quote.quote}
              onPriceChanged={() => {
                quote.retry();
                goTo(3);
                setStepMessage(
                  "The price changed. Please review the new total before paying.",
                );
              }}
              onStockChanged={() => setEventVersion((n) => n + 1)}
            />
          )}

          {stepMessage && (
            <p className={styles.notice} role="alert">
              {stepMessage}
            </p>
          )}

          <div className={`${styles.actions} no-print`}>
            {step > 1 && (
              <button
                type="button"
                className={`${styles.secondaryButton} ${styles.onDark}`}
                onClick={() => goTo((step - 1) as Step)}
              >
                Back
              </button>
            )}
            {step < 4 && (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={next}
              >
                Continue
              </button>
            )}
          </div>
        </div>

        <OrderSummary
          quote={quote}
          promoCode={draft.promoCode}
          hasAttendees={draft.attendees.length > 0}
        />
      </div>
    </main>
  );
}

function Header() {
  return (
    <header className={styles.header}>
      <h1>Sharad Utsav 2026</h1>
      <p>Radha Krishna Temple, Allen, Texas · 10–14 November 2026</p>
    </header>
  );
}

function anchorFor(key: string): string {
  if (key.startsWith("attendee:")) return `attendee-${key.slice(9)}`;
  if (key.startsWith("group:")) return `group-${key.slice(6)}`;
  if (key.startsWith("booker.")) return "booker";
  if (key === "extras") return "extras";
  return "main";
}
