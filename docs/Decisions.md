# Sharad Utsav — Design note

**1 November 2026 · Finalized before coding.**

## How I’ll build it

- I’ll use Next.js and TypeScript with Node.js route handlers, keeping the frontend and API in one project.
- PostgreSQL will keep bookings and stock consistent across requests and preserve them through restarts.
- The booker provides a name, email, current age and optional phone. They must be 18+ but need not attend: paying for others should not add a ticket.
- Attendees will have an ID, name, first-visit date, age on that date and admission choice. Ticket quantities will come from these records so tickets match attendees.
- Day/free admissions have selected dates; all-day passes cover all five days. Dates stay as `YYYY-MM-DD` strings to avoid timezone shifts. Dinner/workshop selections identify a person and date.
- The server will price everything using product IDs and cents ($15 = 1500), avoiding rules based on labels and floating-point money errors. Separate functions make rules easier to test.

## Intended API

- `selection` contains attendees, family groups, extras and one optional promo code.
- `GET /api/event`: no input → `{ event, products, availability }`.
- `POST /api/quote`: `{ selection }` → `{ lines, subtotalCents, discountCents, totalCents, currency }`.
- `POST /api/bookings`: `{ booker, selection, expectedTotalCents, simulation }` plus `Idempotency-Key` → `{ bookingId, receiptPath, quote }`.
- `GET /api/bookings/[token]`: random receipt token → saved attendees, dates, extras and quote, excluding booker contact details.
- Checkout rechecks rules, price and stock; the expected total only detects a price change. One transaction saves the booking and stock deductions together. Reusing the request key returns the same booking.

## Decisions and why

- **Family Pass:** require exactly two adults and two children aged 5–11, as priced. The same family can buy a $40 pass per date, reusing details; each pass remains one-day.
- **Age:** use age on first attendance, fixed across booked days for consistent pricing. Someone who is 11 on Nov 10, turns 12 on Nov 12 and first attends Nov 13 needs an adult ticket.
- **KIDSFREE:** cover individual child day/all-day tickets, excluding Family Passes. The bundle has no separate child price to discount.
- **FLAT20:** require at least a $20 subtotal, including extras: the purchase must cover the discount. Reject smaller bookings’ code attempts. Valid zero-total bookings skip payment and consume selected stock.
- **Promo combinations:** allow one code per booking, keeping savings clear and avoiding discount-order rules.
- **Workshop stock:** share the two remaining places across Nov 11 and Nov 13. Separate allocations would assume additional stock.
- **Changing dates:** automatically remove extras that no longer apply, explain the removal and refresh the quote, preventing charges for cancelled attendance.
- **Reservations:** the first successful checkout gets the stock. Browsing holds nothing, avoiding expiry rules for abandoned bookings.
- **Under-fives:** record their free attendance for the roster. Selected extras cost normally because only entry is free.

## What I’m leaving out

- I’ll simulate payment and provide printable confirmation. Real payments, email, accounts, refunds and an admin screen are deferred to focus on booking correctness and tests.
- I’ll validate declared ages; checking identity documents would require a separate verification process.
