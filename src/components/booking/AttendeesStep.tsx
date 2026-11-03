"use client";

import { useEffect, useRef, type Dispatch } from "react";
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
  const attendeeCount = useRef(draft.attendees.length);
  const groupCount = useRef(draft.familyGroups.length);
  useEffect(() => {
    if (draft.attendees.length > attendeeCount.current) {
      const added = draft.attendees[draft.attendees.length - 1];
      document.getElementById(`${added?.id}-name`)?.focus();
    } else if (draft.attendees.length < attendeeCount.current) {
      document.getElementById("add-person")?.focus();
    }
    attendeeCount.current = draft.attendees.length;
  }, [draft.attendees]);
  useEffect(() => {
    if (draft.familyGroups.length > groupCount.current) {
      const added = draft.familyGroups[draft.familyGroups.length - 1];
      document.getElementById(`group-${added?.id}-dates`)?.focus();
    }
    groupCount.current = draft.familyGroups.length;
  }, [draft.familyGroups]);

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
          issues={issues}
          availability={availability}
          prices={prices}
        />
      ))}

      <div className={styles.actions}>
        <button
          id="add-person"
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
        <p className={styles.onDarkText}>
          <span className={styles.badge}>Sold out</span> Family Passes are sold
          out. A group already added can still be edited or removed.
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
            <fieldset
              id={`group-${group.id}-dates`}
              className={styles.fieldset}
              tabIndex={-1}
            >
              <legend>Dates ({formatUsd(prices.family)} per date)</legend>
              <div className={styles.options}>
                {FESTIVAL_DATES.map((date) => (
                  <label key={date} className={styles.dateOption}>
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
              {members.length === 0
                ? "No members yet."
                : members
                    .map(({ a, i }) => {
                      const memberAge = parseAgeInput(a.ageText);
                      const ageLabel = memberAge.ok
                        ? `age ${memberAge.age} on their first visit`
                        : "age not entered";
                      return `${displayName(a, i)} (${ageLabel})`;
                    })
                    .join(", ")}
            </p>
            <p className={styles.ticketLine}>{familyHint(adults, children)}</p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() =>
                  dispatch({
                    type: "attendeeAdded",
                    id: crypto.randomUUID(),
                    familyId: group.id,
                  })
                }
              >
                Add a member
              </button>
            </div>
            {draft.attendees.some(
              (a) => !(a.mode === "family" && a.familyId === group.id),
            ) && (
              <div className={styles.field}>
                <label className={styles.label} htmlFor={`assign-${group.id}`}>
                  Or add someone already listed
                </label>
                <select
                  id={`assign-${group.id}`}
                  className={styles.select}
                  value=""
                  onChange={(e) => {
                    if (e.target.value === "") return;
                    dispatch({
                      type: "attendeeChanged",
                      id: e.target.value,
                      changes: { mode: "family", familyId: group.id },
                    });
                  }}
                >
                  <option value="">Choose a person</option>
                  {draft.attendees
                    .map((a, i) => ({ a, i }))
                    .filter(
                      ({ a }) =>
                        !(a.mode === "family" && a.familyId === group.id),
                    )
                    .map(({ a, i }) => (
                      <option key={a.id} value={a.id}>
                        {displayName(a, i)}
                      </option>
                    ))}
                </select>
              </div>
            )}
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
          Start a Family Pass
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
  issues,
  availability,
  prices,
}: {
  attendee: DraftAttendee;
  index: number;
  draft: Draft;
  dispatch: Dispatch<Action>;
  issues: UiIssue[] | null;
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

  const category = age.ok ? categoryForAge(age.age) : null;
  const daySoldOut =
    category === "adult"
      ? availability.day_adult === 0
      : category === "child"
        ? availability.day_child === 0
        : false;
  const allDaySoldOut =
    category === "adult"
      ? availability.all_days_adult === 0
      : category === "child"
        ? availability.all_days_child === 0
        : false;
  const familySoldOut = availability.family === 0 && attendee.mode !== "family";
  const fieldMessages = (fieldId: string) => messagesForField(issues, fieldId);
  const modes: {
    value: AttendMode;
    label: string;
    disabled: boolean;
    note: string;
  }[] = [
    {
      value: "days",
      label: "Choose days",
      disabled: daySoldOut && attendee.mode !== "days",
      note: daySoldOut ? "Sold out for this age" : "",
    },
    {
      value: "all_days",
      label: "All five days (All-Day Pass)",
      disabled: allDaySoldOut && attendee.mode !== "all_days",
      note:
        !age.ok && availability.all_days_adult === 0
          ? "Adult: sold out"
          : allDaySoldOut
            ? "Sold out for this age"
            : "",
    },
    {
      value: "family",
      label: "With a Family Pass group",
      disabled: familySoldOut,
      note: availability.family === 0 ? "Sold out" : "",
    },
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
          aria-invalid={fieldMessages(`${id}-name`).length > 0 || undefined}
          aria-describedby={
            fieldMessages(`${id}-name`).length > 0
              ? `${id}-name-error`
              : undefined
          }
          onChange={(e) => change({ name: e.target.value })}
        />
        <IssueList
          id={`${id}-name-error`}
          messages={fieldMessages(`${id}-name`)}
        />
      </div>

      <fieldset id={`${id}-mode`} className={styles.fieldset} tabIndex={-1}>
        <legend>How will they attend?</legend>
        <div className={styles.options}>
          {modes.map((mode) => (
            <label
              key={mode.value}
              className={`${styles.option} ${mode.disabled ? styles.optionDisabled : ""}`}
            >
              <input
                type="radio"
                name={`${id}-mode`}
                checked={attendee.mode === mode.value}
                disabled={mode.disabled}
                onChange={() => change({ mode: mode.value })}
              />
              {mode.label}
              {mode.note !== "" && (
                <span className={styles.badge}>{mode.note}</span>
              )}
            </label>
          ))}
        </div>
        <IssueList messages={fieldMessages(`${id}-mode`)} />
      </fieldset>

      {attendee.mode === "days" && (
        <fieldset id={`${id}-dates`} className={styles.fieldset} tabIndex={-1}>
          <legend>Which days?</legend>
          <div className={styles.options}>
            {FESTIVAL_DATES.map((date) => (
              <label key={date} className={styles.dateOption}>
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
            <p className={styles.hint}>First visit: {DATE_LABELS[first]}</p>
          )}
          <IssueList messages={fieldMessages(`${id}-dates`)} />
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
            aria-invalid={fieldMessages(`${id}-first`).length > 0 || undefined}
            aria-describedby={
              fieldMessages(`${id}-first`).length > 0
                ? `${id}-first-error`
                : undefined
            }
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
          <p className={styles.hint}>
            The pass covers all five days. Age is calculated on this first
            visit, which can be later than the first festival day.
          </p>
          <IssueList
            id={`${id}-first-error`}
            messages={fieldMessages(`${id}-first`)}
          />
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
            aria-invalid={fieldMessages(`${id}-family`).length > 0 || undefined}
            aria-describedby={
              fieldMessages(`${id}-family`).length > 0
                ? `${id}-family-error`
                : undefined
            }
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
          <IssueList
            id={`${id}-family-error`}
            messages={fieldMessages(`${id}-family`)}
          />
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
          aria-invalid={fieldMessages(`${id}-age`).length > 0 || undefined}
          aria-describedby={
            fieldMessages(`${id}-age`).length > 0
              ? `${id}-age-hint ${id}-age-error`
              : `${id}-age-hint`
          }
          value={attendee.ageText}
          onChange={(e) =>
            dispatch({
              type: "attendeeAgeChanged",
              id,
              ageText: e.target.value,
            })
          }
        />
        <IssueList
          id={`${id}-age-error`}
          messages={fieldMessages(`${id}-age`)}
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

function familyHint(adults: number, children: number): string {
  const parts: string[] = [];
  const needAdults = 2 - adults;
  const needChildren = 2 - children;
  if (needAdults > 0) {
    parts.push(
      needAdults === 1
        ? "Add one adult aged 12 or older."
        : `Add ${needAdults} adults aged 12 or older.`,
    );
  }
  if (needChildren > 0) {
    parts.push(
      needChildren === 1
        ? "Add one child aged 5–11."
        : `Add ${needChildren} children aged 5–11.`,
    );
  }
  if (adults > 2) parts.push("This group has more than two adults.");
  if (children > 2)
    parts.push("This group has more than two children aged 5–11.");
  if (parts.length === 0) {
    return "This Family Pass has two adults and two children. Under-fives are added as extra people, not as these four places.";
  }
  return parts.join(" ");
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
