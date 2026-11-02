# Sharad Utsav — Technical plan

This describes how I plan to build the app. It is not a description of finished code. Business behaviour comes from `docs/PRD.md`; the original `DESIGN.md` stays unchanged. Update this plan when the implementation changes, and explain important changes in the README.

## 1. Tools and why

| Part | Choice | Why |
| --- | --- | --- |
| Frontend and API | Next.js App Router, React and TypeScript; Node.js route handlers | Keep the form and API in one project and deploy them together on Vercel. |
| Input validation | Zod plus small rule-checking functions | Check incoming data at runtime, then apply readable booking rules. |
| Database | PostgreSQL on Neon, accessed through `pg` | Keep shared stock durable and save a booking and its stock changes together. |
| Form state | React `useReducer` | Give edits clear names and keep related changes together. |
| Styling | CSS Modules and shared colour/spacing variables | Keep styles close to components and reuse the assignment's theme. |
| Tests | Jest; React Testing Library for selected form interactions | Test prices and ages directly, then check important UI behaviour. |

Use npm, a committed lockfile, strict TypeScript, ESLint and Prettier. Check compatible versions during setup and record the Node version used locally and on Vercel. Add dependencies when their step needs them.

## 2. Where files belong

Create these files gradually. The table shows ownership, not a request to generate everything now.

| Path | What belongs here |
| --- | --- |
| `src/app/page.tsx`, `layout.tsx`, `globals.css` | Page shell, metadata and shared styles. |
| `src/app/api/event/route.ts` | Return event details, products and current stock. |
| `src/app/api/quote/route.ts` | Read the request and ask the quote service for a price. |
| `src/app/api/bookings/route.ts` | Read checkout input and call the booking service. |
| `src/app/api/bookings/[token]/route.ts` | Return a saved confirmation without booker contact details. |
| `src/app/confirmation/[token]/page.tsx` | Display and print the saved confirmation. |
| `src/components/booking/` | Attendee, ticket, extras, contact, summary and payment components; styles alongside them. |
| `src/components/booking/booking-reducer.ts`, `use-quote.ts` | Form edits and quote-request handling. |
| `src/domain/booking/types.ts` | Attendee, admission, family, selection and quote types. |
| `src/domain/booking/age.ts`, `validation.ts` | Age categories and rules connecting people, tickets, dates and extras. |
| `src/domain/booking/pricing.ts`, `promotions.ts`, `inventory.ts` | Price lines, discounts and required stock units. |
| `src/server/catalog.ts`, `schemas.ts` | Trusted product/promo definitions and request schemas. |
| `src/server/quote-service.ts`, `booking-service.ts` | Coordinate rules and database work. The booking service owns checkout. |
| `src/server/db.ts`, `booking-repository.ts`, `http-errors.ts` | Connections, SQL operations and safe API errors. |
| `src/**/*.test.ts`, `src/**/*.test.tsx` | Tests beside the behaviour they check. |
| `tests/integration/` | Tests against a separate PostgreSQL database. |
| `db/migrations/`, `db/seed.sql`, `scripts/` | Schema changes, initial stock and small database commands. |
| `docs/PRD.md`, `docs/TECHNICAL.md` | Requirements and this implementation plan. |

Keep `DESIGN.md`, `README.md` and `TEST-CASES.md` at the repository root.

## 3. Keep the code understandable

- Components display fields and handle interaction. They do not decide the final price.
- Route handlers read requests, call a service and return HTTP responses.
- Services coordinate the work. Database helpers contain SQL; they do not send HTTP responses.
- Domain functions contain the booking rules. They take inputs and return results without importing React or database code.
- Use product IDs, such as `day_adult`, instead of matching display labels.
- Use clear names, small focused functions and one main responsibility per file. Split by responsibility rather than an arbitrary line limit.
- Keep incomplete form input separate from validated data. An empty age field must not become age zero, and `"12abc"` must not become 12.
- Use strict types, with no `any`, unsafe casts or disabled checks to hide errors. Treat unvalidated API and saved JSON data as `unknown` until checked.

## 4. People, tickets and dates

The booker is `{ name, email, age, phone? }`. Their age means current age.

An attendee has `id`, `name`, `firstVisitDate`, `ageAtFirstVisit` and one `admission`. Stable IDs distinguish people even when their names are the same.

| Admission kind | Other fields | Meaning |
| --- | --- | --- |
| `day` | `category`, `dates` | Adult or child entry on selected dates. |
| `all_days` | `category` | Adult or child entry covering all five dates. |
| `family` | `familyId` | Membership of one family group. |
| `free` | `dates` | Under-five attendance on selected dates. |

- A family group is `{ id, dates }`. Its members are the attendees referring to its ID. Require exactly two adults and two children; charge once per group per date. Avoid a second editable member list that could disagree with the attendees.
- Use allowed `YYYY-MM-DD` strings for attendance dates. Reject duplicate or out-of-festival dates.
- For day, free and family admissions, `firstVisitDate` must equal the earliest selected attendance date.
- An All-Day Pass still covers all five dates even when its holder first arrives later. Keep the declared first visit separately for age classification. Extras must be covered by the admission and cannot be dated before that first visit.
- Classify using `ageAtFirstVisit`; do not recalculate the category on each booked day. If the first visit changes, ask the user to check that age again.
- `selection` contains `attendees`, `familyGroups`, `extras` and an optional `promoCode`. Extras contain a sticks quantity and dinner/workshop selections referring to an attendee and date.
- Extra quantity limits remain open in PRD section 8. Settle them before finalising those schemas; do not quietly impose a one-plate limit or another unreviewed cap.

## 5. API shapes

Use JSON and integer cents. `quote` means `{ lines, subtotalCents, discountCents, totalCents, currency }`. Each line is `{ productId, description, quantity, unitPriceCents, amountCents }`.

| Endpoint | Request | Success response |
| --- | --- | --- |
| `GET /api/event` | None | `200 { event, products, availability }` |
| `POST /api/quote` | `{ selection }` | `200 quote` |
| `POST /api/bookings` | `{ booker, selection, expectedTotalCents, simulation }` plus `Idempotency-Key` | `201 { bookingId, receiptPath, quote }`; a successful replay returns `200` with the same booking. |
| `GET /api/bookings/[token]` | Receipt token in the URL | `200 { bookingId, attendees, familyGroups, extras, promoCode, quote, createdAt, paymentMode }` |

`simulation` is `"success"` or `"decline"`. It controls a labelled demo, not a real charge. A valid zero-total booking skips the simulated charge.

`expectedTotalCents` is the total the user reviewed. The server recalculates independently; a mismatch requires another review. Quotes do not reserve stock.

Errors use `{ error: { code, message, fields } }`, where `fields` contains `{ path, message }` entries. Examples of paths are `selection.attendees.0.ageAtFirstVisit` and `selection.promoCode`.

- `400`: malformed JSON, unexpected fields or an invalid request shape/key.
- `422`: an age, admission, date, extra or promo rule fails, including `FLAT20` below its minimum.
- `409`: stock shortage, price change or the same checkout key used with different content.
- `402`: simulated payment decline; `404`: unknown receipt; `503`: temporary database unavailability.

Return safe messages, not SQL errors or request bodies. Use `Cache-Control: no-store` for current availability and booking responses, with `private` on receipts. Keep database access at request time rather than requiring a live database during the build.

## 6. Pricing and stock rules

- The server catalog supplies prices. Strict schemas reject browser-supplied unit prices and discounts. The quote and checkout services use the same domain functions.
- Calculate with integer cents. `SEVA10` applies once to the whole subtotal, rounding its discount to the nearest cent with halves rounded up.
- `FLAT20` requires a subtotal of at least 2000 cents, then subtracts exactly 2000. Do not cap it to a smaller subtotal.
- `KIDSFREE` removes individual child entry charges only. Discounts do not reduce the number of stock units required.
- Treat the brief's stock as one shared count per product. A Day Pass uses one unit per person/date; an All-Day Pass uses one per person; a Family Pass uses one per group/date and does not also use individual ticket stock. Extras use their selected units; both workshop dates use the same stock row.
- Validate IDs, names, ages, dates, family composition, extras and promos on the server. UI checks are helpful feedback, not enforcement.

**Example:** an adult Day Pass and one pair of sticks cost 1500 + 500 cents. `FLAT20` makes the total zero, but checkout still deducts one adult Day Pass and one pair of sticks.

## 7. Saving a booking safely

Use three small tables initially:

| Table | Stored data |
| --- | --- |
| `inventory` | Product ID and remaining quantity, with a database check preventing negative stock. |
| `bookings` | Booking ID, unique random receipt token, booker and selection snapshots, saved quote, creation time and simulated/free payment mode. |
| `booking_requests` | Unique checkout key, a fingerprint of the request content and its booking ID. |

Save selections and quotes as JSONB snapshots so a receipt shows what was booked at the time. Separate attendee tables can wait until reporting or editing bookings needs them.

An **idempotency key** is a unique ID for one checkout attempt. Retrying that attempt must not create another booking.

1. Validate the request shape and create a stable fingerprint of all submitted content, including contact, selection, expected total and simulation choice.
2. Start a database transaction: its changes either all succeed or all roll back. Claim the unique checkout key inside it. Concurrent requests with that key must wait for the first transaction to finish.
3. If the key already exists, compare fingerprints. Return the original booking for matching content; otherwise return a conflict. Do this before checking today's prices or stock, so retries still work after an item sells out.
4. For a new key, validate the booking rules and recalculate the price. Reject price changes and positive-total simulated declines.
5. Deduct each required product only if enough stock remains, processing product IDs in a consistent order. If any deduction fails, roll back everything.
6. Save the booking and link it to the checkout key, then commit. Every committed key must identify a complete booking. Release the database connection even after an error.

Use one checked-out `pg` client for the whole transaction, including calls to database helpers. Separate `pool.query()` calls must not be used to run its individual statements. [Transaction reference](https://node-postgres.com/features/transactions).

Seed missing inventory rows only. Do not reset existing stock on startup or deployment. A connection lost around commit leaves the outcome uncertain; retry the same content and key to find the saved result.

## 8. Form state and recovery

- Use named reducer actions such as `attendeeAdded`, `dateRemoved` and `admissionChanged`. Date/person removal also removes invalid extras and produces an explanation.
- Represent the flow as `editing`, `quoting`, `review`, `submitting` and `confirmed`, with errors kept alongside the entered data.
- Every selection edit invalidates the reviewed quote. Cancel older quote requests and ignore any late response for an older draft.
- Disable confirmation while the quote is stale or checkout is pending.
- Create one checkout key for the exact submitted content. After a timeout, keep that content and key for retry; do not generate a fresh one or allow an uncertain booking to be replaced silently.
- After a definite rejection and an edit, use a new key. Preserve enough pending-request information in tab-scoped session storage to retry after a reload; clear it once resolved. Never treat browser storage as authoritative booking or stock data.

## 9. Tests and deployment

- Start with Jest tests for age boundaries, first-visit changes, prices, promo failures, zero totals and Family Passes on multiple dates. Domain and database tests run in a Node environment.
- Use React Testing Library for date edits, dependent-extra removal, stale quotes and error recovery. Component tests use a browser-like environment.
- Use a separate real PostgreSQL database to test competing stock requests, repeated checkout keys and rollback after a failure. Mocks cannot prove these database behaviours.
- Check the complete flow on phones and with a keyboard. Use browser checks for async Server Components rather than trying to unit-test them with Jest. Add a small Playwright suite if time allows.
- Add CI checks for lint, types, unit/integration tests and build as those commands become available. Record skipped or unavailable checks honestly in `TEST-CASES.md`.

| Environment variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Pooled application connection to Neon. |
| `DIRECT_DATABASE_URL` | Direct connection for migration tooling when required. |
| `TEST_DATABASE_URL` | Isolated test database, never production. |

Keep credentials server-only and out of Git. Commit a sanitised `.env.example` and ignore files containing real values. Use parameterized SQL and mark server modules as server-only.

Reuse a small `pg` pool in each application instance and register it with Vercel's `attachDatabasePool` helper. Use the Neon pooled connection for requests. Check version-specific setup before implementation. [Neon pooling](https://neon.com/docs/connect/connection-pooling) · [Vercel pooling](https://vercel.com/kb/guide/connection-pooling-with-functions).

Use an unpredictable receipt token generated from 32 random bytes; exclude booker contact details from receipts and avoid logging tokens or personal data. Prevent receipt indexing and referrer leakage.

Deploy an early working slice to Vercel. Before submission, verify the production build, public access, environment variables and persistent stock. Integration-test cleanup must never touch production data.

## 10. How we will build this

Work on one file at a time, explain its purpose and inputs/outputs, and review it before moving on. Run meaningful tests once the relevant pieces exist. Commit complete, understandable steps rather than creating an artificial history.

Planned order: project setup; domain types and rules with tests; catalog and quote API; database checkout and failure tests; form; confirmation; deployment checks. Resolve the open extra rules before their implementation. Keep `TEST-CASES.md` and the README current as checks actually run.

Official setup references: [Next.js route handlers](https://nextjs.org/docs/app/getting-started/route-handlers) and [Next.js Jest guide](https://nextjs.org/docs/app/guides/testing/jest). Folder names and the database model above are project choices.
