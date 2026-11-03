import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/booking/booking.module.css";
import { DATE_LABELS, describeAdmission } from "@/components/booking/format";
import { QuoteTable } from "@/components/booking/QuoteTable";
import { findBookingByToken } from "@/server/booking-repository";
import { getPool } from "@/server/db";
import { quoteSchema, selectionSchema } from "@/server/schemas";
import { ReceiptActions } from "./PrintButton";

export const metadata: Metadata = {
  title: "Booking confirmation — Sharad Utsav 2026",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let booking: Awaited<ReturnType<typeof findBookingByToken>> = null;
  let unavailable = false;
  if (/^[A-Za-z0-9_-]{43}$/.test(token)) {
    try {
      booking = await findBookingByToken(getPool(), token);
    } catch (error) {
      console.error(
        "Loading confirmation failed:",
        error instanceof Error ? error.message : "unknown error",
      );
      unavailable = true;
    }
  }

  if (booking === null) {
    return (
      <main className={styles.page}>
        <div className={styles.card} role="alert">
          <h1>
            {unavailable
              ? "Booking temporarily unavailable"
              : "Booking not found"}
          </h1>
          <p>
            {unavailable
              ? "We couldn't load this booking right now. Please refresh the page in a moment."
              : "We couldn't find this booking. Check the link."}
          </p>
          <Link href="/">Back to booking</Link>
        </div>
      </main>
    );
  }

  const selection = selectionSchema.parse(booking.selection);
  const quote = quoteSchema.parse(booking.quote);
  const names = new Map(selection.attendees.map((a) => [a.id, a.name]));

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1>Booking confirmed</h1>
        <p>Sharad Utsav 2026 · Radha Krishna Temple, Allen, Texas</p>
      </header>

      <section className={styles.card} aria-labelledby="ref-title">
        <p className={styles.kicker}>Booking reference</p>
        <h2 id="ref-title" className={styles.reference}>
          {booking.id}
        </h2>
        <p>
          {booking.paymentMode === "free"
            ? "Free booking: no payment was needed."
            : "Simulated payment: no real money was charged."}{" "}
          Booked on{" "}
          {booking.createdAt.toLocaleString("en-US", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "America/Chicago",
          })}{" "}
          (Texas time).
        </p>
        <ReceiptActions />
      </section>

      <section className={styles.card} aria-labelledby="people-title">
        <h2 id="people-title">Attendees and tickets</h2>
        <ul className={styles.peopleList}>
          {selection.attendees.map((attendee) => (
            <li key={attendee.id}>
              <strong>{attendee.name}</strong>:{" "}
              {describeAdmission(attendee, selection.familyGroups)}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.card} aria-labelledby="extras-title">
        <h2 id="extras-title">Extras</h2>
        {selection.extras.sticksPairs === 0 &&
        selection.extras.dinners.length === 0 &&
        selection.extras.workshops.length === 0 ? (
          <p>No extras.</p>
        ) : (
          <ul className={styles.peopleList}>
            {selection.extras.sticksPairs > 0 && (
              <li>
                Dandiya Sticks: {selection.extras.sticksPairs}{" "}
                {selection.extras.sticksPairs === 1 ? "pair" : "pairs"}
              </li>
            )}
            {selection.extras.dinners.map((d) => (
              <li key={`dinner-${d.attendeeId}-${d.date}`}>
                Dinner Plate: {names.get(d.attendeeId)}, {DATE_LABELS[d.date]}
              </li>
            ))}
            {selection.extras.workshops.map((w) => (
              <li key={`workshop-${w.attendeeId}-${w.date}`}>
                Garba Workshop: {names.get(w.attendeeId)}, {DATE_LABELS[w.date]}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.card} aria-labelledby="total-title">
        <h2 id="total-title">Total</h2>
        {selection.promoCode && <p>Promo code: {selection.promoCode}</p>}
        <QuoteTable
          quote={quote}
          promoCode={selection.promoCode ?? null}
          caption="Itemized total"
        />
      </section>

      <p className="no-print">
        <Link href="/">Make another booking</Link>
      </p>
    </main>
  );
}
