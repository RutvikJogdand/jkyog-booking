# Sharad Utsav — Product requirements

This is the checklist for what the app should do. It follows the assignment and the decisions reviewed so far. These are requirements to build and test, not claims that the app is finished.

## 1. Goal

A family should be able to book entry and extras together, see the correct price, complete a simulated payment and receive a confirmation. The booking records who is coming, on which dates, and what each person has booked.

- **Event:** Sharad Utsav 2026, Radha Krishna Temple, Allen, Texas.
- **Dates:** 10–14 November 2026.
- **Currency:** USD.

## 2. Booking flow

1. Add attendees, names, ages, tickets and attendance dates.
2. Choose extras and enter the booker's contact details.
3. Apply an optional promo and review an itemized total.
4. Complete the clearly labelled simulated payment, or confirm a valid free booking.
5. View a saved confirmation that can be reopened and printed.

People can edit their choices before confirming. Preserve their details after validation errors, stock conflicts and retryable network failures.

## 3. Tickets and extras

Prices and starting quantities come from the assignment. Availability decreases as bookings are completed.

| Item | Price and coverage | Starting stock |
| --- | --- | ---: |
| Adult Day Pass | $15 per person, per selected date; ages 12+ | 380 |
| Child Day Pass | $8 per person, per selected date; ages 5–11 | 260 |
| Adult All-Day Pass | $60 per person for all five dates | 0 — sold out |
| Child All-Day Pass | $30 per person for all five dates | 140 |
| Family Pass | $40 for exactly two adults and two children, for one date | 95 |
| Dandiya Sticks | $5 per pair | 900 |
| Dinner Plate | $12 per person, per date | 1700 |
| Garba Workshop | $20 per person, per session; November 11 or 13 | 2 total |

- Each attendee has one admission kind: Day Pass, All-Day Pass, Family Pass membership or free under-five entry.
- Day Passes allow selected festival dates. All-Day Passes always cover all five dates; their coverage cannot be shortened.
- Family Pass adults are 12+ and children are 5–11. Under-fives are additional free attendees, not substitutes for the two child places.
- The same four people can use a Family Pass on multiple dates. Charge $40 and use one Family Pass from stock per date; collect their details once. Two dates cost $80.
- Dinner and workshop selections belong to a named attendee and date and require attendance on that date. Free entry does not make extras free.
- Both workshop dates share the two remaining places.
- Show sold-out products clearly and prevent purchasing them on both the page and the API.

## 4. People and ages

- The booker provides a name, valid email, current age and optional phone. They must be at least 18 now and need not attend. If attending, include them in the attendee list too.
- Each attendee provides a name, first-visit date, age on that date, admission choice and attendance dates. Children do not need their own email or phone.
- Tell people to enter their age **when they first attend the festival**, not today or on the festival's opening day. Keep that age category for all dates in this booking.
- Under 5: free entry. Ages 5–11: child admission. Ages 12+: adult admission.
- Record under-fives and their dates for the attendance list, without charging for or requiring an entry ticket.
- Reject missing details, invalid emails, negative, fractional or nonnumeric ages, and tickets that do not match the age category. Ages are declared; identity verification is outside this exercise.
- Keep people and ticket quantities matched after edits. One adult attending three dates has one attendee record and three adult Day Pass units.

**Example:** someone is 11 on November 10, turns 12 on November 12 and first attends on November 13. They need adult admission. Someone who first attends at 11 keeps the child category for their booked dates, even if their birthday falls later during the festival.

## 5. Promos and prices

The subtotal is tickets plus selected extras before discount. Allow one promo code per booking.

| Code | Required behaviour |
| --- | --- |
| `SEVA10` | Take 10% off the whole booking, including extras. |
| `FLAT20` | Take $20 off only when the subtotal is at least $20, including extras. Otherwise explain the $20 minimum. |
| `KIDSFREE` | Make individual child Day and All-Day tickets free. Family Passes, adult tickets and extras keep their prices. |
| `EXPIRED5` | Explain that the code has expired; apply no discount. |
| `MAXEDOUT` | Explain that the code has reached its usage limit; apply no discount. |
| Any other code | Explain that the code is not recognised; apply no discount. |

- Show ticket and extra charges, subtotal, savings and final total separately.
- The server calculates prices and validates promos using its own data. Editing a browser request must not let someone choose their own prices or discounts.
- Calculate money in cents and display it as USD.
- A valid $0 total skips payment, creates a booking and uses the selected ticket or extra stock. Under-five entry itself has no ticket stock to deduct.
- Refresh the quote after changes. An old response must not replace the price for a newer selection.

**Examples:** a $15 ticket cannot use `FLAT20`. A $15 ticket plus $5 sticks can use it and totals $0. `KIDSFREE` does not reduce the $40 Family Pass.

## 6. Changes, checkout and confirmation

- Removing a person or attendance date automatically removes extras that no longer apply. Explain what was removed and refresh the total.
- Changing a first-visit date requires checking the declared age for that date again. Recheck ticket and family eligibility.
- Browsing and quotes do not reserve stock. The first successful checkout gets the available stock.
- At checkout, recheck ages, tickets, dates, extras, promo, total and availability on the server. Direct API requests follow the same rules as the form.
- If the reviewed price has changed, show the new total for review before confirmation.
- Save the booking and reduce stock together. Failures must not leave partial bookings or deductions. Stock must survive restarts and deployments.
- Double-clicking or retrying the same checkout returns the same booking and deducts stock only once.
- Simulated payment supports success and failure, collects no card details and clearly states that no real money is charged. Failed payment consumes no stock.
- Confirmation shows the booking reference, attendees, dates, tickets, extras, promo and total. Its receipt link reopens the saved booking without exposing the booker's contact details.

## 7. Usability and appearance

- Work on phones and with a keyboard. Use visible labels, clear focus states and errors that explain how to fix the problem; do not rely on colour alone.
- Show loading, empty, sold-out, failure and retry states. Keep the order summary easy to find.
- Use the supplied dark and gold theme, translucent cards on dark surfaces, serif headings and a sans-serif body. Check colour contrast.

| Colour token | Value |
| --- | --- |
| `primaryDark` | `#2C2C2C` |
| `primary` | `#C99B24` |
| `gold` | `#BC9226` |
| `brightGold` | `#D1AC3E` |
| `cream` | `#FDF3E4` |
| `heading` | `#291900` |
| `primary-text` | `#645743` |
| `white` | `#FFFFFF` |
| `success` | `#28A736` |
| `error` | `#EF1F1F` |

## 8. Scope and remaining decisions

- Build one festival's booking flow with simulated payment and printable confirmation.
- Defer real payments, email delivery, accounts, refunds, an admin screen and identity verification to focus on booking correctness.
- Exact extra-quantity limits, including what counts as a reasonable sticks quantity, still need review. Settle those one at a time before implementing the related validation; no unreviewed caps are introduced here.
- Preserve the original `DESIGN.md`. Record later decisions and reasons in the README under **"Decisions I made"**.

## 9. Checks before submission

- Test money and ages with Jest or Vitest: `FLAT20` below and at $20, `KIDSFREE` with Family Passes, birthdays around first attendance and repeat Family Pass dates.
- Test stock competition and repeated checkout requests against the database. Two bookings each asking for the last two workshop places cannot both succeed.
- Check date edits, rejected promos, sold-out tickets, payment failure and confirmation reopening. Record expected outcomes and actual results in `TEST-CASES.md`.
- Verify the production build and booking flow on Vercel, including phone and keyboard use. Configure environment variables and keep secrets out of Git.
- Put the public production URL at the top of the README. Document local setup, environment variables, API contract, decisions and unfinished work.
- Keep genuine small commits and the design-before-code history. Record a 3–5 minute deployed-site walkthrough, including failures.

The app is ready when these checks pass, with any omissions stated plainly. Keep each piece small enough to explain and change during the interview.
