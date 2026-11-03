"use client";

import type { Dispatch } from "react";
import { categoryForAge, parseAgeInput } from "@/domain/booking/age";
import {
  FESTIVAL_DATES,
  type FestivalDate,
  type ProductId,
} from "@/domain/booking/types";
import {
  displayName,
  firstVisit,
  needsAgeCheck,
  type Action,
  type AttendMode,
  type Draft,
  type DraftAttendee,
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

function toggleDate(dates: FestivalDate[], date: FestivalDate): FestivalDate[] {
  return dates.includes(date)
    ? dates.filter((d) => d !== date)
    : [...dates, date].sort();
}

export function AttendeesStep({
  draft,
  dispatch,
  issues,
  availability,
  prices,
}: Props) {
  return (
    <>
      <IssueList messages={issuesFor(issues, "general")} />
      {draft.attendees.length === 0 && (
        <div className={styles.card}>
          <p>
            No one added yet. Add each person who is coming, including children.
          </p>
        </div>
      )}

      {draft.attendees.map((attendee, i) => (
        <AttendeeCard
          key={attendee.id}
          attendee={attendee}
          index={i}
          draft={draft}
          dispatch={dispatch}
          messages={issuesFor(issues, `attendee:${attendee.id}`)}
          availability={availability}
          prices={prices}
        />
      ))}

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.secondaryButton} ${styles.onDark}`}
          onClick={() =>
            dispatch({ type: "attendeeAdded", id: crypto.randomUUID() })
          }
        >
          Add a person
        </button>
      </div>

      <h2>Family Passes</h2>
      <p>
        A Family Pass is {formatUsd(prices.family)} per date for exactly 2
        adults (12+) and 2 children (5–11). Children under 5 come free and are
        added as their own person with &quot;Choose days&quot;.
      </p>
      {availability.family === 0 && (
        <p>
          <span className={styles.badge}>Sold out</span> Family Passes are sold
          out.
        </p>
      )}

      {draft.familyGroups.map((group, j) => {
        const members = draft.attendees
          .map((a, i) => ({ a, i }))
          .filter(({ a }) => a.mode === "family" && a.familyId === group.id);
        let adults = 0;
        let children = 0;
        for (const { a } of members) {
          const age = parseAgeInput(a.ageText);
          if (!age.ok) continue;
          const category = categoryForAge(age.age);
          if (category === "adult") adults += 1;
          if (category === "child") children += 1;
        }
        return (
          <section
            key={group.id}
            id={`group-${group.id}`}
            className={styles.card}
            aria-labelledby={`group-${group.id}-title`}
          >
            <h3 id={`group-${group.id}-title`}>Family Pass {j + 1}</h3>
            <fieldset className={styles.fieldset}>
              <legend>Dates ({formatUsd(prices.family)} per date)</legend>
              <div className={styles.options}>
                {FESTIVAL_DATES.map((date) => (
                  <label key={date} className={styles.option}>
                    <input
                      type="checkbox"
                      checked={group.dates.includes(date)}
                      onChange={() =>
                        dispatch({
                          type: "familyGroupDatesChanged",
                          id: group.id,
                          dates: toggleDate(group.dates, date),
                        })
                      }
                    />
                    {DATE_LABELS[date]}
                  </label>
                ))}
              </div>
            </fieldset>
            <p>
              Members:{" "}
              {members.length === 0
                ? "none yet. Choose this Family Pass on each person's card."
                : members.map(({ a, i }) => displayName(a, i)).join(", ")}
            </p>
            <p className={styles.ticketLine}>
              Adults: {adults} of 2 · Children: {children} of 2
            </p>
            <IssueList messages={issuesFor(issues, `group:${group.id}`)} />
            <button
              type="button"
              className={styles.linkButton}
              onClick={() =>
                dispatch({ type: "familyGroupRemoved", id: group.id })
              }
            >
              Remove Family Pass {j + 1}
            </button>
          </section>
        );
      })}

      <div className={styles.actions}>
        <button
          type="button"
          className={`${styles.secondaryButton} ${styles.onDark}`}
          disabled={availability.family === 0}
          onClick={() =>
            dispatch({ type: "familyGroupAdded", id: crypto.randomUUID() })
          }
        >
          Add a Family Pass
        </button>
      </div>
    </>
  );
}

function AttendeeCard({
  attendee,
  index,
  draft,
  dispatch,
  messages,
  availability,
  prices,
}: {
  attendee: DraftAttendee;
  index: number;
  draft: Draft;
  dispatch: Dispatch<Action>;
  messages: string[];
  availability: Availability;
  prices: Record<ProductId, number>;
}) {
  const id = attendee.id;
  const first = firstVisit(attendee, draft.familyGroups);
  const age = parseAgeInput(attendee.ageText);
  const name = displayName(attendee, index);
  const change = (
    changes: Extract<Action, { type: "attendeeChanged" }>["changes"],
  ) => dispatch({ type: "attendeeChanged", id, changes });

  const modes: { value: AttendMode; label: string }[] = [
    { value: "days", label: "Choose days" },
    { value: "all_days", label: "All five days (All-Day Pass)" },
    { value: "family", label: "With a Family Pass group" },
  ];

  return (
    <section
      id={`attendee-${id}`}
      className={styles.card}
      aria-labelledby={`attendee-${id}-title`}
    >
      <h3 id={`attendee-${id}-title`}>{name}</h3>

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${id}-name`}>
          Name
        </label>
        <input
          id={`${id}-name`}
          className={styles.input}
          value={attendee.name}
          autoComplete="off"
          onChange={(e) => change({ name: e.target.value })}
        />
      </div>

      <fieldset className={styles.fieldset}>
        <legend>How will they attend?</legend>
        <div className={styles.options}>
          {modes.map((mode) => (
            <label key={mode.value} className={styles.option}>
              <input
                type="radio"
                name={`${id}-mode`}
                checked={attendee.mode === mode.value}
                onChange={() => change({ mode: mode.value })}
              />
              {mode.label}
              {mode.value === "all_days" &&
                availability.all_days_adult === 0 && (
                  <span className={styles.badge}>Adult: sold out</span>
                )}
            </label>
          ))}
        </div>
      </fieldset>

      {attendee.mode === "days" && (
        <fieldset className={styles.fieldset}>
          <legend>Which days?</legend>
          <div className={styles.options}>
            {FESTIVAL_DATES.map((date) => (
              <label key={date} className={styles.option}>
                <input
                  type="checkbox"
                  checked={attendee.dates.includes(date)}
                  onChange={() =>
                    change({ dates: toggleDate(attendee.dates, date) })
                  }
                />
                {DATE_LABELS[date]}
              </label>
            ))}
          </div>
          {first && (
            <p className={styles.hint}>First day: {DATE_LABELS[first]}</p>
          )}
        </fieldset>
      )}

      {attendee.mode === "all_days" && (
        <div className={styles.field}>
          <p className={styles.hint}>
            Covers all five days. Adult {formatUsd(prices.all_days_adult)},
            child {formatUsd(prices.all_days_child)}.
          </p>
          <label className={styles.label} htmlFor={`${id}-first`}>
            First day they&apos;ll come
          </label>
          <select
            id={`${id}-first`}
            className={styles.select}
            value={attendee.allDaysFirstVisit ?? ""}
            onChange={(e) =>
              change({
                allDaysFirstVisit:
                  e.target.value === ""
                    ? null
                    : (e.target.value as FestivalDate),
              })
            }
          >
            <option value="">Choose a day</option>
            {FESTIVAL_DATES.map((date) => (
              <option key={date} value={date}>
                {DATE_LABELS[date]}
              </option>
            ))}
          </select>
        </div>
      )}

      {attendee.mode === "family" && (
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${id}-family`}>
            Family Pass group
          </label>
          <select
            id={`${id}-family`}
            className={styles.select}
            value={attendee.familyId ?? ""}
            onChange={(e) =>
              change({
                familyId: e.target.value === "" ? null : e.target.value,
              })
            }
          >
            <option value="">
              {draft.familyGroups.length === 0
                ? "Add a Family Pass below first"
                : "Choose a Family Pass"}
            </option>
            {draft.familyGroups.map((group, j) => (
              <option key={group.id} value={group.id}>
                Family Pass {j + 1}
              </option>
            ))}
          </select>
          {first && (
            <p className={styles.hint}>
              Dates from the Family Pass. First day: {DATE_LABELS[first]}
            </p>
          )}
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${id}-age`}>
          {first
            ? `Age on ${DATE_LABELS[first]} (their first day)`
            : "Age on their first day"}
        </label>
        <p className={styles.hint} id={`${id}-age-hint`}>
          {first
            ? "Enter their age on the day they first attend the festival, not today's age."
            : "Choose their days first."}
        </p>
        <input
          id={`${id}-age`}
          className={styles.input}
          style={{ maxWidth: "8rem" }}
          inputMode="numeric"
          disabled={first === null}
          aria-describedby={`${id}-age-hint`}
          value={attendee.ageText}
          onChange={(e) =>
            dispatch({
              type: "attendeeAgeChanged",
              id,
              ageText: e.target.value,
            })
          }
        />
      </div>

      {needsAgeCheck(attendee, draft.familyGroups) && first && (
        <div className={styles.error} role="status">
          Their first day is now {DATE_LABELS[first]}. Check their age for that
          day.{" "}
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => dispatch({ type: "attendeeAgeConfirmed", id })}
          >
            The age is correct
          </button>
        </div>
      )}

      {age.ok && first && (
        <p className={styles.ticketLine}>
          Ticket: {ticketText(attendee, age.age, prices)}
        </p>
      )}

      <IssueList messages={messages} />

      <button
        type="button"
        className={styles.linkButton}
        onClick={() => dispatch({ type: "attendeeRemoved", id })}
      >
        Remove {name}
      </button>
    </section>
  );
}

function ticketText(
  attendee: DraftAttendee,
  age: number,
  prices: Record<ProductId, number>,
): string {
  const category = categoryForAge(age);
  if (category === "under_five") {
    return attendee.mode === "family"
      ? "Under 5: can't fill a Family Pass place"
      : "Free entry (under 5)";
  }
  const who = category === "adult" ? "Adult" : "Child";
  if (attendee.mode === "days") {
    const n = attendee.dates.length;
    return `${who} Day Pass · ${formatUsd(prices[`day_${category}`])} per day · ${n} ${n === 1 ? "day" : "days"}`;
  }
  if (attendee.mode === "all_days") {
    return `${who} All-Day Pass · ${formatUsd(prices[`all_days_${category}`])}`;
  }
  return `Family Pass member (${who.toLowerCase()})`;
}
