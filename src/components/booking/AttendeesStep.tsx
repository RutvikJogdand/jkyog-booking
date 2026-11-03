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

function focusWithoutJump(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: "nearest" });
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
      focusWithoutJump(`${added?.id}-name`);
    } else if (draft.attendees.length < attendeeCount.current) {
      focusWithoutJump("add-person");
    }
    attendeeCount.current = draft.attendees.length;
  }, [draft.attendees]);
  useEffect(() => {
    if (draft.familyGroups.length > groupCount.current) {
      const added = draft.familyGroups[draft.familyGroups.length - 1];
      focusWithoutJump(`group-${added?.id}-title`);
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

      {draft.attendees.map((attendee, i) =>
        attendee.mode === "family" && attendee.familyId ? null : (
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
        ),
      )}

      <div className={styles.actions}>
        <button
          id="add-person"
          type="button"
          className={`${styles.secondaryButton} ${styles.onDark} ${styles.addPerson}`}
          onClick={() =>
            dispatch({ type: "attendeeAdded", id: crypto.randomUUID() })
          }
        >
          Add a person
        </button>
      </div>

      <section className={styles.card} aria-labelledby="family-passes-title">
        <h2 id="family-passes-title">Family Pass</h2>
        <p className={styles.quietNote}>
          One pass is {formatUsd(prices.family)} for one date: 2 adults aged 12
          or older and 2 children aged 5–11. Add those four people in this
          section. Children under 5 are not part of the pass — add them above
          with their own ticket.
        </p>
        {availability.family === 0 && (
          <p>
            <span className={styles.badge}>Sold out</span> Family Passes are
            sold out. A group already added can still be edited or removed.
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
              className={styles.familyPanel}
              aria-labelledby={`group-${group.id}-title`}
            >
              <h3 id={`group-${group.id}-title`} tabIndex={-1}>
                Family Pass {j + 1}
              </h3>
              <fieldset
                id={`group-${group.id}-dates`}
                className={styles.fieldset}
                tabIndex={-1}
              >
                <legend>Dates ({formatUsd(prices.family)} per date)</legend>
                <div className={`${styles.options} ${styles.dateGrid}`}>
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
              <p className={styles.progress}>
                Adults: {adults} of 2 · Children: {children} of 2
              </p>
              <p className={styles.hint}>{familyHint(adults, children)}</p>
              {members.map(({ a, i }) => (
                <AttendeeCard
                  key={a.id}
                  attendee={a}
                  index={i}
                  draft={draft}
                  dispatch={dispatch}
                  issues={issues}
                  availability={availability}
                  prices={prices}
                  embedded
                />
              ))}
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
                  Add a member to this pass
                </button>
              </div>
              {draft.attendees.some(
                (a) => !(a.mode === "family" && a.familyId === group.id),
              ) && (
                <div className={styles.field}>
                  <label
                    className={styles.label}
                    htmlFor={`assign-${group.id}`}
                  >
                    Move someone who already has their own ticket
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
            className={styles.secondaryButton}
            disabled={availability.family === 0}
            onClick={() =>
              dispatch({ type: "familyGroupAdded", id: crypto.randomUUID() })
            }
          >
            Start a Family Pass
          </button>
        </div>
      </section>
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
  embedded = false,
}: {
  attendee: DraftAttendee;
  index: number;
  draft: Draft;
  dispatch: Dispatch<Action>;
  issues: UiIssue[] | null;
  availability: Availability;
  prices: Record<ProductId, number>;
  embedded?: boolean;
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
  useEffect(() => {
    if (attendee.mode === "all_days" && allDaySoldOut) {
      dispatch({ type: "attendeeChanged", id, changes: { mode: "days" } });
    }
  }, [attendee.mode, allDaySoldOut, dispatch, id]);
  const familySoldOut = availability.family === 0 && attendee.mode !== "family";
  const fieldMessages = (fieldId: string) => messagesForField(issues, fieldId);
  const modes: {
    value: AttendMode;
    label: string;
    detail: string;
    disabled: boolean;
    note: string;
  }[] = [
    {
      value: "days",
      label: "Choose days",
      detail: "Pay for each date they attend.",
      disabled: daySoldOut && attendee.mode !== "days",
      note: daySoldOut ? "Sold out" : "",
    },
    {
      value: "all_days",
      label: "All five days (All-Day Pass)",
      detail: "One pass for all five dates.",
      disabled: allDaySoldOut,
      note: allDaySoldOut ? "Sold out" : "",
    },
    {
      value: "family",
      label: "With a Family Pass group",
      detail:
        "Join a group of 2 adults and 2 children. Each date uses one pass.",
      disabled: familySoldOut,
      note: availability.family === 0 ? "Sold out" : "",
    },
  ];

  return (
    <section
      id={`attendee-${id}`}
      className={embedded ? styles.memberCard : styles.card}
      aria-labelledby={`attendee-${id}-title`}
    >
      <div className={styles.cardHeader}>
        <h3 id={`attendee-${id}-title`}>{name}</h3>
        <button
          type="button"
          className={styles.linkButton}
          onClick={() => dispatch({ type: "attendeeRemoved", id })}
        >
          Remove {name}
        </button>
      </div>

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

      <div className={styles.field}>
        <label className={styles.label} htmlFor={`${id}-age`}>
          {first
            ? `Age on ${DATE_LABELS[first]} (their first day)`
            : "Age on their first day"}
        </label>
        <p className={styles.hint} id={`${id}-age-hint`}>
          How old will this person be on their first day at the festival? This
          decides which ticket they can use.
        </p>
        <input
          id={`${id}-age`}
          className={styles.input}
          style={{ maxWidth: "8rem" }}
          inputMode="numeric"
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

      {embedded ? (
        <p className={styles.hint}>
          Included in this Family Pass. Their dates are the dates selected
          above.{" "}
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => change({ mode: "days", familyId: null })}
          >
            Move {name} to their own ticket
          </button>
        </p>
      ) : age.ok ? (
        <fieldset id={`${id}-mode`} className={styles.fieldset} tabIndex={-1}>
          <legend>How will they attend?</legend>
          <div className={styles.options}>
            {modes.map((mode) => (
              <label
                key={mode.value}
                className={`${styles.option} ${styles.choice} ${mode.disabled ? styles.optionDisabled : ""}`}
              >
                <input
                  type="radio"
                  name={`${id}-mode`}
                  checked={attendee.mode === mode.value}
                  disabled={mode.disabled}
                  onChange={() => change({ mode: mode.value })}
                />
                <span>
                  {mode.label}
                  {mode.note !== "" && (
                    <>
                      {" "}
                      <span className={styles.badge}>{mode.note}</span>
                    </>
                  )}
                  <span className={styles.choiceDetail}>{mode.detail}</span>
                </span>
              </label>
            ))}
          </div>
          <IssueList messages={fieldMessages(`${id}-mode`)} />
        </fieldset>
      ) : null}

      {age.ok && attendee.mode === "days" && (
        <fieldset id={`${id}-dates`} className={styles.fieldset} tabIndex={-1}>
          <legend>Which days?</legend>
          <div className={`${styles.options} ${styles.dateGrid}`}>
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

      {age.ok && attendee.mode === "all_days" && !allDaySoldOut && (
        <div className={styles.field}>
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
            Their age is taken on this day. The pass still covers all five
            dates.
          </p>
          <IssueList
            id={`${id}-first-error`}
            messages={fieldMessages(`${id}-first`)}
          />
        </div>
      )}

      {age.ok && attendee.mode === "family" && !embedded && (
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
