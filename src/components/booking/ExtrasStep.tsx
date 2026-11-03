"use client";

import type { Dispatch } from "react";
import { categoryForAge, parseAgeInput } from "@/domain/booking/age";
import { WORKSHOP_DATES, type ProductId } from "@/domain/booking/types";
import { MAX_STICKS_PAIRS } from "@/domain/booking/validation";
import {
  admittedDates,
  displayName,
  parseSticks,
  type Action,
  type Draft,
  type DraftBooker,
} from "./booking-reducer";
import styles from "./booking.module.css";
import { DATE_LABELS, formatUsd } from "./format";
import { IssueList } from "./IssueList";
import {
  issuesFor,
  messagesForField,
  type Availability,
  type UiIssue,
} from "./step-checks";

interface Props {
  draft: Draft;
  dispatch: Dispatch<Action>;
  issues: UiIssue[] | null;
  availability: Availability;
  prices: Record<ProductId, number>;
}

export function ExtrasStep({
  draft,
  dispatch,
  issues,
  availability,
  prices,
}: Props) {
  const maxSticks = Math.min(MAX_STICKS_PAIRS, availability.dandiya_sticks);
  const sticks = parseSticks(draft.sticksText);
  const stickPairs = sticks.ok ? sticks.pairs : null;
  const workshopPlacesLeft = availability.garba_workshop;
  const workshopsFull = draft.workshops.length >= workshopPlacesLeft;
  const dinnersFull = draft.dinners.length >= availability.dinner_plate;
  const hasUnderFive = draft.attendees.some((a) => {
    const age = parseAgeInput(a.ageText);
    return age.ok && categoryForAge(age.age) === "under_five";
  });

  return (
    <>
      <section
        id="extras"
        className={styles.card}
        aria-labelledby="extras-title"
      >
        <h2 id="extras-title">Extras</h2>
        <IssueList messages={issuesFor(issues, "extras")} />

        <h3>Dandiya Sticks · {formatUsd(prices.dandiya_sticks)} per pair</h3>
        <p className={styles.hint} id="sticks-hint">
          One pair is two sticks. The number is for the whole booking, not for
          each person. Set it to 0 if you don&apos;t want any.
        </p>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="sticks">
            Pairs for the booking (0–{MAX_STICKS_PAIRS})
          </label>
          <div className={styles.stepper}>
            <button
              type="button"
              aria-label="Remove a pair"
              disabled={stickPairs === null || stickPairs <= 0}
              onClick={() =>
                dispatch({
                  type: "sticksChanged",
                  text: String((stickPairs ?? 0) - 1),
                })
              }
            >
              −
            </button>
            <input
              id="sticks"
              className={styles.input}
              inputMode="numeric"
              aria-invalid={!sticks.ok || undefined}
              aria-describedby={
                !sticks.ok ? "sticks-hint sticks-error" : "sticks-hint"
              }
              value={draft.sticksText}
              onChange={(e) =>
                dispatch({ type: "sticksChanged", text: e.target.value })
              }
            />
            <button
              type="button"
              aria-label="Add a pair"
              disabled={stickPairs === null || stickPairs >= maxSticks}
              onClick={() =>
                dispatch({
                  type: "sticksChanged",
                  text: String((stickPairs ?? 0) + 1),
                })
              }
            >
              +
            </button>
          </div>
          {!sticks.ok && (
            <p id="sticks-error" className={styles.error} role="alert">
              <strong>Error:</strong> {sticks.message}
            </p>
          )}
          {sticks.ok && stickPairs !== null && stickPairs > 0 && (
            <p className={styles.hint}>
              {stickPairs} {stickPairs === 1 ? "pair is" : "pairs are"}{" "}
              {stickPairs * 2} sticks.
            </p>
          )}
          {availability.dandiya_sticks === 0 && (
            <p>
              <span className={styles.badge}>Sold out</span> No new pairs can be
              added.
            </p>
          )}
        </div>

        <h3>
          Dinner Plate · {formatUsd(prices.dinner_plate)} per person, per day
        </h3>
        <p className={styles.hint}>
          Dinner is not included with a ticket. Tick a date to add one plate for
          that person on that day, and untick it to remove the plate. Each
          person can have at most one plate on each day they are attending.
        </p>
        {hasUnderFive && (
          <p className={styles.hint}>
            Entry is free for under-fives; a dinner plate is still{" "}
            {formatUsd(prices.dinner_plate)} if you add one.
          </p>
        )}
        {availability.dinner_plate === 0 ? (
          <p aria-live="polite">
            Dinner Plates are sold out. Any plate already chosen can still be
            removed.
          </p>
        ) : availability.dinner_plate <= 10 ? (
          <p aria-live="polite">
            Only {availability.dinner_plate} dinner{" "}
            {availability.dinner_plate === 1 ? "plate is" : "plates are"} left.
          </p>
        ) : null}
        {draft.attendees.map((attendee, i) => {
          const attending = admittedDates(attendee, draft.familyGroups);
          const name = displayName(attendee, i);
          if (attending.length === 0) return null;
          return (
            <fieldset key={attendee.id} className={styles.fieldset}>
              <legend>{name}</legend>
              <div className={`${styles.options} ${styles.dateGrid}`}>
                {attending.map((date) => {
                  const checked = draft.dinners.some(
                    (d) => d.attendeeId === attendee.id && d.date === date,
                  );
                  const blocked = !checked && dinnersFull;
                  return (
                    <label
                      key={date}
                      className={`${styles.dateOption} ${blocked ? styles.optionDisabled : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={blocked}
                        onChange={() =>
                          dispatch({
                            type: "dinnerToggled",
                            pick: { attendeeId: attendee.id, date },
                          })
                        }
                      />
                      {DATE_LABELS[date]} · {formatUsd(prices.dinner_plate)}
                      {blocked ? " (sold out)" : ""}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

        <h3>
          Garba Workshop · {formatUsd(prices.garba_workshop)} per person, per
          session
        </h3>
        <p className={styles.hint}>
          The workshop is not included. Tick Wednesday, Friday, or both to add a
          place for that person, and untick a day to remove it.
        </p>
        <p aria-live="polite">{workshopAvailabilityNote(workshopPlacesLeft)}</p>
        {draft.attendees.map((attendee, i) => {
          const attending = admittedDates(attendee, draft.familyGroups);
          const sessions = WORKSHOP_DATES.filter((d) => attending.includes(d));
          const name = displayName(attendee, i);
          if (sessions.length === 0) return null;
          return (
            <fieldset key={attendee.id} className={styles.fieldset}>
              <legend>{name}</legend>
              <div className={`${styles.options} ${styles.dateGrid}`}>
                {sessions.map((date) => {
                  const checked = draft.workshops.some(
                    (w) => w.attendeeId === attendee.id && w.date === date,
                  );
                  const disabled = !checked && workshopsFull;
                  return (
                    <label
                      key={date}
                      className={`${styles.dateOption} ${disabled ? styles.optionDisabled : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() =>
                          dispatch({
                            type: "workshopToggled",
                            pick: { attendeeId: attendee.id, date },
                          })
                        }
                      />
                      {DATE_LABELS[date]} · {formatUsd(prices.garba_workshop)}
                      {disabled ? " (no places left)" : ""}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
      </section>

      <ContactForm
        booker={draft.booker}
        onChange={(changes) => dispatch({ type: "bookerChanged", changes })}
        issues={issues}
      />
    </>
  );
}

function workshopAvailabilityNote(placesLeft: number): string {
  if (placesLeft === 0) {
    return "No workshop places are left for Wednesday and Friday. A place already chosen can still be removed.";
  }
  const remaining =
    placesLeft === 1 ? "1 place is left" : `${placesLeft} places are left`;
  return `${remaining} for Wednesday and Friday together. Each day you tick uses one place.`;
}

function ContactForm({
  booker,
  onChange,
  issues,
}: {
  booker: DraftBooker;
  onChange: (changes: Partial<DraftBooker>) => void;
  issues: UiIssue[] | null;
}) {
  const fields: {
    key: keyof DraftBooker;
    label: string;
    autoComplete: string;
    type?: string;
    inputMode?: "numeric" | "tel" | "email";
  }[] = [
    { key: "name", label: "Your name", autoComplete: "name" },
    {
      key: "email",
      label: "Email",
      autoComplete: "email",
      type: "email",
      inputMode: "email",
    },
    {
      key: "ageText",
      label: "Your age today",
      autoComplete: "off",
      inputMode: "numeric",
    },
    {
      key: "phone",
      label: "Phone (optional)",
      autoComplete: "tel",
      type: "tel",
      inputMode: "tel",
    },
  ];

  return (
    <section id="booker" className={styles.card} aria-labelledby="booker-title">
      <h2 id="booker-title">Your contact details</h2>
      <p className={styles.quietNote}>
        Your own details are fine here when you are booking for someone else.
        Add yourself in step 1 if you are coming too.
      </p>
      <div className={styles.contactGrid}>
        {fields.map((field) => {
          const fieldId = `booker-${field.key}`;
          const messages = messagesForField(issues, fieldId);
          const errorId = `${fieldId}-error`;
          return (
            <div key={field.key} className={styles.field}>
              <label className={styles.label} htmlFor={fieldId}>
                {field.label}
              </label>
              {field.key === "ageText" && (
                <p className={styles.hint} id="booker-age-hint">
                  The person booking must be 18 or older today.
                </p>
              )}
              <input
                id={fieldId}
                className={styles.input}
                type={field.type ?? "text"}
                inputMode={field.inputMode}
                autoComplete={field.autoComplete}
                aria-invalid={messages.length > 0 || undefined}
                aria-describedby={
                  [
                    field.key === "ageText" ? "booker-age-hint" : null,
                    messages.length > 0 ? errorId : null,
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                value={booker[field.key]}
                onChange={(e) => onChange({ [field.key]: e.target.value })}
              />
              <IssueList id={errorId} messages={messages} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
