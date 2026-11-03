"use client";

import type { Dispatch } from "react";
import { categoryForAge, parseAgeInput } from "@/domain/booking/age";
import {
  FESTIVAL_DATES,
  WORKSHOP_DATES,
  type ProductId,
} from "@/domain/booking/types";
import { MAX_STICKS_PAIRS } from "@/domain/booking/validation";
import {
  admittedDates,
  displayName,
  type Action,
  type Draft,
  type DraftBooker,
} from "./booking-reducer";
import styles from "./booking.module.css";
import { DATE_LABELS, formatUsd } from "./format";
import { IssueList } from "./IssueList";
import { issuesFor, type Availability, type UiIssue } from "./step-checks";

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
  const workshopPlacesLeft = availability.garba_workshop;
  const workshopsFull = draft.workshops.length >= workshopPlacesLeft;
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
        <div className={styles.field}>
          <label className={styles.label} htmlFor="sticks">
            Pairs for the booking (0–{MAX_STICKS_PAIRS})
          </label>
          <div className={styles.stepper}>
            <button
              type="button"
              aria-label="Remove a pair"
              disabled={draft.sticksPairs <= 0}
              onClick={() =>
                dispatch({
                  type: "sticksChanged",
                  pairs: draft.sticksPairs - 1,
                })
              }
            >
              −
            </button>
            <input
              id="sticks"
              className={styles.input}
              inputMode="numeric"
              value={String(draft.sticksPairs)}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
                dispatch({
                  type: "sticksChanged",
                  pairs: Number(digits || "0"),
                });
              }}
            />
            <button
              type="button"
              aria-label="Add a pair"
              disabled={draft.sticksPairs >= maxSticks}
              onClick={() =>
                dispatch({
                  type: "sticksChanged",
                  pairs: draft.sticksPairs + 1,
                })
              }
            >
              +
            </button>
          </div>
          {availability.dandiya_sticks === 0 && (
            <p>
              <span className={styles.badge}>Sold out</span>
            </p>
          )}
        </div>

        <h3>
          Dinner Plate · {formatUsd(prices.dinner_plate)} per person, per day
        </h3>
        {hasUnderFive && (
          <p className={styles.hint}>
            Entry is free for under-fives; extras are charged normally.
          </p>
        )}
        {availability.dinner_plate === 0 ? (
          <p>
            <span className={styles.badge}>Sold out</span>
          </p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <caption className={styles.srOnly}>
                Dinner Plates by person and day
              </caption>
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  {FESTIVAL_DATES.map((date) => (
                    <th key={date} scope="col">
                      {DATE_LABELS[date]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {draft.attendees.map((attendee, i) => {
                  const attending = admittedDates(attendee, draft.familyGroups);
                  const name = displayName(attendee, i);
                  return (
                    <tr key={attendee.id}>
                      <th scope="row">{name}</th>
                      {FESTIVAL_DATES.map((date) => (
                        <td key={date}>
                          {attending.includes(date) ? (
                            <input
                              type="checkbox"
                              aria-label={`Dinner Plate for ${name} on ${DATE_LABELS[date]}`}
                              checked={draft.dinners.some(
                                (d) =>
                                  d.attendeeId === attendee.id &&
                                  d.date === date,
                              )}
                              onChange={() =>
                                dispatch({
                                  type: "dinnerToggled",
                                  pick: { attendeeId: attendee.id, date },
                                })
                              }
                            />
                          ) : (
                            <span className={styles.muted}>Not attending</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <h3>
          Garba Workshop · {formatUsd(prices.garba_workshop)} per person, per
          session
        </h3>
        <p aria-live="polite">
          {workshopPlacesLeft === 0 ? (
            <span className={styles.badge}>Sold out</span>
          ) : (
            `${workshopPlacesLeft} ${workshopPlacesLeft === 1 ? "place" : "places"} left across both sessions (Wed 11 Nov and Fri 13 Nov).`
          )}
        </p>
        {workshopPlacesLeft > 0 &&
          draft.attendees.map((attendee, i) => {
            const attending = admittedDates(attendee, draft.familyGroups);
            const sessions = WORKSHOP_DATES.filter((d) =>
              attending.includes(d),
            );
            const name = displayName(attendee, i);
            if (sessions.length === 0) return null;
            return (
              <fieldset key={attendee.id} className={styles.fieldset}>
                <legend>{name}</legend>
                <div className={styles.options}>
                  {sessions.map((date) => {
                    const checked = draft.workshops.some(
                      (w) => w.attendeeId === attendee.id && w.date === date,
                    );
                    const disabled = !checked && workshopsFull;
                    return (
                      <label
                        key={date}
                        className={`${styles.option} ${disabled ? styles.optionDisabled : ""}`}
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
                        {DATE_LABELS[date]}
                        {disabled && " (no places left)"}
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
      <p className={styles.hint}>
        You don&apos;t need to attend. If you are coming, add yourself as a
        person in step 1.
      </p>
      {fields.map((field) => {
        const issueKey = `booker.${field.key === "ageText" ? "age" : field.key}`;
        return (
          <div key={field.key} className={styles.field}>
            <label className={styles.label} htmlFor={`booker-${field.key}`}>
              {field.label}
            </label>
            <input
              id={`booker-${field.key}`}
              className={styles.input}
              type={field.type ?? "text"}
              inputMode={field.inputMode}
              autoComplete={field.autoComplete}
              value={booker[field.key]}
              onChange={(e) => onChange({ [field.key]: e.target.value })}
            />
            <IssueList messages={issuesFor(issues, issueKey)} />
          </div>
        );
      })}
    </section>
  );
}
