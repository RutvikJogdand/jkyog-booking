# jkyog-booking

**Live app: https://jkyog-booking.vercel.app**

Booking for Sharad Utsav 2026 (10–14 November, Radha Krishna Temple, Allen, Texas): entry tickets, Family Passes and extras, priced on the server, with simulated payment and a printable confirmation.

## Local setup

Developed with Node.js 24.19.0 and npm 11.17.0. `package.json` requires Node 24.x.

1. Install dependencies: `npm install`
2. Install the Neon CLI (`npm i -g neon`) and sign in: `neon login`
3. Pull the database variables into `.env.local`: `neon env pull`
4. Create the tables and starting stock: `npm run db:migrate` (safe to re-run; it never resets stock)
5. Start the app: `npm run dev`, then open http://localhost:3000. `GET /api/health` checks the database connection.

`.env.example` lists the variable names. Real values stay in `.env.local`, which Git ignores.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server. |
| `npm run build` / `npm start` | Production build and server. |
| `npm run lint` | ESLint with the Next.js and TypeScript rules. |
| `npm run typecheck` | TypeScript without emitting files. |
| `npm run format` / `npm run format:check` | Prettier for code and config. Markdown is excluded so `DESIGN.md` stays unchanged. |
| `npm test` | Jest unit tests. `.env.local` is not loaded in tests, so they cannot reach the app database. |
| `npm run db:migrate` | Applies `db/migrations/*.sql` once each, then inserts any missing stock rows from `db/seed.sql`. |
| `npm run test:integration` | Migrates the Neon `test` branch, then runs the checkout tests in `tests/integration/` against it (needs `.env.test.local`). They reset that branch's data. |

## API

All money is in integer cents. Errors are `{ error: { code, message, fields: [{ path, message }] } }`.

| Endpoint | Success | Errors |
| --- | --- | --- |
| `GET /api/event` | `200 { event, products, availability }` | `503` |
| `POST /api/quote` `{ selection }` | `200 { lines, subtotalCents, discountCents, totalCents, currency }` | `400` shape, `422` booking rule or promo |
| `POST /api/bookings` `{ booker, selection, expectedTotalCents, simulation }` + `Idempotency-Key` header | `201 { bookingId, receiptPath, quote }`; the same key and content again returns `200` with the same booking | `400`, `422`, `409` stock / price changed / key reused, `402` simulated decline, `503` |
| `GET /api/bookings/[token]` | `200` saved booking without the booker's contact details | `404`, `503` |

## Decisions I made

This section records the booking decisions I made before coding and the additional choices made during implementation. The original `DESIGN.md` stays unchanged.

### Decisions made before coding

Some booking situations were not fully explained in the brief. These are the questions I considered, what I decided, and why.

1. **Can someone use `FLAT20` when their booking costs less than $20?**

   **Decision:** Require a subtotal of at least $20, including extras. A $15 booking cannot use the code. Exactly $20 is allowed, making the final total $0. A valid $0 booking skips payment but still uses the selected stock.

   **Why:** The purchase should cover the full $20 discount. A clear minimum avoids changing the discount amount depending on the booking.

2. **Can a Family Pass cover a different combination of adults and children?**

   **Decision:** Require exactly two adults aged 12+ and two children aged 5–11. Under-fives can attend free alongside them, but cannot replace a child in the bundle. Other combinations use individual tickets, and additional family members need their own admission.

   **Why:** The supplied price covers that specific combination. There is no pricing rule for substitutions or smaller bundles.

3. **Does `KIDSFREE` also discount a Family Pass?**

   **Decision:** Apply it to individual child Day and All-Day admission only. The Family Pass remains $40, and extras remain chargeable.

   **Why:** The Family Pass has one bundle price, with no separate child price to remove. Free admission also does not imply free meals or workshops.

4. **Which age determines a ticket if someone has a birthday during the festival?**

   **Decision:** Tell people to choose their ticket using their age when they first attend the festival. Keep that age category across their booked days, regardless of how many days they attend.

   For example, someone who is 11 on November 10, turns 12 on November 12, and first attends on November 13 needs an adult ticket. If they first attend while still 11, their child category stays the same for that booking.

   **Why:** Their age when they actually arrive is what matters. Keeping that category fixed also avoids changing the price halfway through their visit.

5. **Are the two remaining workshop places available on each date, or shared across both dates?**

   **Decision:** Share the two places across November 11 and November 13. A place booked on either date reduces the same remaining stock.

   **Why:** The brief gives two remaining places without separate allocations. Treating that as two per date would invent additional availability.

6. **What happens to dinner or workshop selections when someone removes an attendance date?**

   **Decision:** Automatically remove extras no longer covered by that person's attendance. Explain what was removed and why, then update the total.

   **Why:** People should not be charged for activities on a day they are no longer attending. Explaining the removal makes the change visible.

7. **Can the same family buy Family Passes for multiple dates?**

   **Decision:** Yes. Collect the four people's details once and allow multiple dates. Each date costs $40 and uses one Family Pass from stock. Two dates cost $80 and use two passes.

   **Why:** Each pass covers one day, but a family attending several days should not have to enter the same people repeatedly.

8. **Can someone combine multiple promo codes?**

   **Decision:** Allow only one active promo code per booking. Discounts cannot be stacked.

   **Why:** The brief does not explain how combined discounts work or which applies first. One code keeps the calculation clear.

9. **Does selecting a ticket or getting a quote reserve stock?**

   **Decision:** No. Stock goes to the first successful checkout. Checkout checks availability again and saves the booking together with its stock deductions.

   **Why:** Someone leaving a form unfinished should not block other families from booking. This also avoids reservation timers and expiry rules.

10. **Do under-fives need to be included in the booking, and are their extras free?**

    **Decision:** Record their names and attendance dates even though admission is free. Charge the normal price for any selected dinner or workshop places.

    **Why:** Free admission should not make someone disappear from the attendance list. The free-entry rule applies to admission, not everything they might use.

11. **Does the person making the booking have to attend?**

    **Decision:** No. Keep the booker separate from the attendees. The booker must currently be 18 or older, but only needs an admission entry if they are attending.

    **Why:** Someone may book and pay for their family without coming themselves. Entering contact details should not automatically add a ticket.

### Additional decisions during implementation

- **Dandiya Sticks: 0–10 pairs per booking, never more than the remaining stock.** Ten pairs covers a large family without letting one booking take an excessive share of souvenir stock. The UI and the API enforce the same limit.
- **Dinner Plate: at most one per attendee per attendance date.** The assignment prices dinner "per person, per day" and doesn't mention multiple plates. Under-fives pay the normal $12. The UI shows one checkbox per attendee and date.
- **Ages: whole numbers from 0 to 150.** The assignment sets no maximum; a cap catches typing mistakes such as 1500 while allowing every real age. It applies to attendee ages and the booker's age.
- **Promo codes must match exactly.** Letter case and spaces count, so `seva10` or ` SEVA10` is "not recognised". The assignment lists the codes in capitals and doesn't ask for looser matching.
- **`KIDSFREE` is rejected when the booking has no individual child tickets**, with "This code only applies to child tickets." Applying it for a $0 discount would look like a working code that did nothing.
- **A booking needs at least one attendee.** Extras belong to people who attend, so a booking of only extras is rejected.
- **Booking references look like `SU-7KQ2M9XA`**: 8 random characters without look-alikes such as 0/O and 1/I, so they are easy to read out. The receipt link uses a separate 32-byte random token.
- **Garba Workshop: at most one place per attendee per session, and both sessions are allowed.** The assignment lists November 11 and 13 without limiting attendees to one session. Each session is $20, needs admission on that date, and draws from the shared two places.
- **A promo code joins the booking only after the server accepts it.** A rejected code returns `422` with the reason, and the summary keeps the price without it.
- **Under-fives use "Choose days" or "All five days" and become free entry automatically**; they can't take a Family Pass place.
- **When someone's first day changes, their entered age is kept and must be confirmed** ("The age is correct") before continuing, instead of being cleared.
- **Layout:** a step-by-step wizard with the order summary in a sidebar on wide screens and a bottom bar on phones; cream cards (95% opaque) on the dark page, system serif and sans-serif fonts. Contrast choices are in `docs/UI.md` section 7.
- **Sticks are typed as text and checked afterwards.** The field used to delete every character that was not a digit, so `-1` became 1 and `1.0` became 10. Invalid text now stays as typed and shows an error, and the quote waits until the number is a whole value from 0 to 10.
- **A checkout attempt is saved in this tab before it is sent.** Reloading during an uncertain result offers a retry of that same request and key. Editing and the payment choice stay locked until the result is confirmed or definitely rejected. A simulated decline is a definite rejection, so the next try can use a different choice and a new key.
- **Sold-out extras that are already selected stay on screen so they can be removed.** New selections are blocked. A stock conflict from checkout includes product ids, and the form opens the extras step for sticks, dinner or the shared workshop, or the people step for tickets.
- **The summary never treats an old total as the current one.** Clearing every person clears the amount. A promo that stops applying, such as `FLAT20` after the subtotal falls below $20, shows the server's reason and a Remove code button instead of "Applied" or "Updating total…".
- **An Adult All-Day Pass cannot be newly selected when that product has no stock and the person's age is already an adult.** Child All-Day admission and under-five free attendance stay available. If the age is not entered yet, the choice stays available and is labelled "Adult: sold out".

## Project structure

- `src/domain/booking/` — booking rules with no React or database code: ages, pricing, promos, stock units, validation, and the response shapes the browser checks.
- `src/server/` — catalog (trusted prices and codes), request schemas, quote and checkout services, SQL.
- `src/app/api/` — route handlers; `src/app/confirmation/[token]` — printable receipt.
- `src/components/booking/` — the wizard, its reducer, the live quote hook and the saved checkout attempt.
- `db/` and `scripts/migrate.mjs` — schema, starting stock and migrations.

## Unfinished or deliberately left out

- Real payments, email, accounts, refunds, an admin screen and identity checks (out of scope in `DESIGN.md`).
- An unknown receipt address returns the "Booking not found" page with HTTP 200 rather than 404.
- Vercel is not connected to GitHub, so deployments are made with `vercel deploy --prod`. GitHub Actions is set up for checks, not for deploying.

