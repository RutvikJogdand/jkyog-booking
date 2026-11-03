"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import {
  eventResponseSchema,
  type EventResponse,
} from "@/domain/booking/responses";
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
import { formatFestivalRange } from "./format";
import { OrderSummary } from "./OrderSummary";
import { PaymentStep } from "./PaymentStep";
import { ReviewStep } from "./ReviewStep";
import {
  fieldForServerPath,
  stepOneIssues,
  stepTwoIssues,
  type Availability,
  type ProductNames,
  type UiIssue,
} from "./step-checks";
import { useCheckout } from "./use-checkout";
import { useQuote } from "./use-quote";

type Step = 1 | 2 | 3 | 4;

const STEP_NAMES: Record<Step, string> = {
  1: "People and tickets",
  2: "Extras and contact",
  3: "Review",
  4: "Payment",
};

const NEXT_LABEL: Record<1 | 2 | 3, string> = {
  1: "Continue to extras",
  2: "Review booking",
  3: "Continue to payment",
};

const EXTRA_PRODUCTS = new Set<ProductId>([
  "dandiya_sticks",
  "dinner_plate",
  "garba_workshop",
]);

export function BookingApp() {
  const [eventData, setEventData] = useState<EventResponse | null>(null);
  const [eventFailed, setEventFailed] = useState(false);
  const [eventVersion, setEventVersion] = useState(0);
  const [draft, dispatch] = useReducer(bookingReducer, initialDraft);
  const [chosenStep, setChosenStep] = useState<Step | null>(null);
  const [showIssues, setShowIssues] = useState<Record<Step, boolean>>({
    1: false,
    2: false,
    3: false,
    4: false,
  });
  const focusErrors = useRef(false);
  const [stepMessage, setStepMessage] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<"success" | "decline">(
    "success",
  );
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const checkout = useCheckout();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/event", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("event failed");
        const parsed = eventResponseSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error("event shape");
        if (!cancelled) {
          setEventData(parsed.data);
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
    if (!checkout.locked) headingRef.current?.focus();
  }, [chosenStep, checkout.locked]);

  const step = chosenStep ?? (checkout.locked || checkout.restored ? 4 : 1);
  const selection = toSelection(draft);
  const quote = useQuote(selection);

  if (eventData === null) {
    return (
      <main id="main" className={styles.page}>
        <Header event={null} />
        {eventFailed ? (
          <div className={styles.card} role="alert">
            <p>We couldn&apos;t load the festival details.</p>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => setEventVersion((n) => n + 1)}
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
    if (target >= 4 && (quote.status !== "ready" || quote.quote === null)) {
      return false;
    }
    return true;
  };

  function goTo(target: Step, force = false) {
    if (checkout.locked && !force) return;
    setStepMessage(null);
    setChosenStep(target);
  }

  function next() {
    if (checkout.locked) return;
    if (step === 1 || step === 2) {
      if (issuesByStep[step].length > 0) {
        setShowIssues((current) => ({ ...current, [step]: true }));
        focusErrors.current = true;
        queueMicrotask(() => {
          if (!focusErrors.current) return;
          document.getElementById("error-summary")?.focus();
          focusErrors.current = false;
        });
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

  async function pay() {
    const result = await checkout.submit(
      checkout.phase === "uncertain" || !selection || !quote.quote
        ? ""
        : JSON.stringify({
            booker: toBooker(draft.booker),
            selection,
            expectedTotalCents: quote.quote.totalCents,
            simulation: quote.quote.totalCents === 0 ? "success" : simulation,
          }),
    );
    if (result.kind !== "rejected") return;
    if (result.code === "price_changed") {
      quote.retry();
      goTo(3, true);
      setStepMessage(
        "The price changed. Please review the new total before paying.",
      );
      return;
    }
    if (result.code === "out_of_stock") {
      setEventVersion((n) => n + 1);
      const extrasOnly =
        result.productIds.length > 0 &&
        result.productIds.every((id) => EXTRA_PRODUCTS.has(id));
      goTo(extrasOnly ? 2 : 1, true);
      setStepMessage(result.message);
      return;
    }
    const target = result.fields
      .map((field) => fieldForServerPath(field.path, draft))
      .find((item) => item !== null);
    if (target) {
      goTo(target.step, true);
      window.setTimeout(() => {
        document.getElementById(target.fieldId)?.focus();
      }, 0);
    }
  }

  function openIssue(issue: UiIssue) {
    const field = document.getElementById(issue.fieldId ?? "add-person");
    field?.focus();
  }

  const visibleIssues =
    (step === 1 || step === 2) && showIssues[step] ? issuesByStep[step] : null;
  const currentQuote = quote.status === "ready" ? quote.quote : null;

  return (
    <main id="main" className={styles.page}>
      <Header event={eventData.event} />
      {eventFailed && (
        <div className={styles.card} role="alert">
          <p>
            Ticket availability couldn&apos;t be refreshed. The numbers on this
            page may be out of date.
          </p>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => setEventVersion((n) => n + 1)}
          >
            Try again
          </button>
        </div>
      )}
      {checkout.storageNote && (
        <p className={styles.notice} role="status">
          {checkout.storageNote}
        </p>
      )}

      <div className={styles.layout}>
        <div>
          <nav aria-label="Booking steps">
            <ol className={styles.steps}>
              {([1, 2, 3, 4] as const).map((s) => {
                const completed = s < step && canEnter(s);
                return (
                  <li key={s}>
                    <button
                      type="button"
                      className={`${styles.stepButton} ${s === step ? styles.stepCurrent : ""} ${completed ? styles.stepDone : ""}`}
                      aria-current={s === step ? "step" : undefined}
                      disabled={
                        checkout.locked ||
                        s === step ||
                        s > step ||
                        !canEnter(s)
                      }
                      onClick={() => goTo(s)}
                    >
                      <span className={styles.stepIndex} aria-hidden="true">
                        {s}
                      </span>
                      <span className={styles.stepLabel}>
                        <span className={styles.srOnly}>{s}. </span>
                        {STEP_NAMES[s]}
                        {completed ? (
                          <span className={styles.srOnly}> (done)</span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
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
                    <button
                      type="button"
                      className={styles.linkButton}
                      onClick={() => openIssue(issue)}
                    >
                      {issue.label}: {issue.message}
                    </button>
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
              goToStep={(target) => goTo(target)}
            />
          )}
          {step === 4 &&
            (checkout.phase === "uncertain" ||
              (checkout.phase === "submitting" && currentQuote === null)) && (
              <section className={styles.card} aria-labelledby="recover-title">
                <h2 id="recover-title">Finish this checkout</h2>
                <p>
                  We couldn&apos;t confirm whether this checkout went through.
                  Retrying sends the same request again, so a booking that was
                  already saved is not created twice.
                </p>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={checkout.phase === "submitting"}
                  onClick={() => void pay()}
                >
                  {checkout.phase === "submitting"
                    ? "Processing…"
                    : "Retry the same checkout"}
                </button>
              </section>
            )}
          {step === 4 && checkout.phase !== "uncertain" && currentQuote && (
            <PaymentStep
              quote={currentQuote}
              simulation={simulation}
              onSimulationChange={setSimulation}
              onPay={() => void pay()}
              submitting={checkout.phase === "submitting"}
              uncertain={false}
              rejection={checkout.rejection}
              onOpenField={(path) => {
                const target = fieldForServerPath(path, draft);
                if (!target) return;
                goTo(target.step, true);
                window.setTimeout(() => {
                  document.getElementById(target.fieldId)?.focus();
                }, 0);
              }}
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
                disabled={checkout.locked}
                onClick={() => goTo((step - 1) as Step)}
              >
                Back
              </button>
            )}
            {(step === 1 || step === 2 || step === 3) && (
              <button
                type="button"
                className={styles.primaryButton}
                onClick={next}
              >
                {NEXT_LABEL[step]}
              </button>
            )}
          </div>
        </div>

        <OrderSummary
          quote={quote}
          promoCode={quote.status === "ready" ? draft.promoCode : null}
          hasAttendees={draft.attendees.length > 0}
        />
      </div>
    </main>
  );
}

function Header({ event }: { event: EventResponse["event"] | null }) {
  return (
    <header className={styles.header}>
      <p className={styles.kicker}>Booking</p>
      <h1>{event?.name ?? "Sharad Utsav"}</h1>
      {event === null ? (
        <p>Loading festival details…</p>
      ) : (
        <p className={styles.eventMeta}>
          <span>{event.venue}</span>
          <span aria-hidden="true">·</span>
          <span>{formatFestivalRange(event.dates)}</span>
        </p>
      )}
    </header>
  );
}
