# Test cases

Results recorded on 3 November 2026. The first automated run had 142 unit tests. After the recovery and form fixes, `npm test` has 157 unit and component tests. `npm run test:integration` still has 11 PostgreSQL tests and now refuses to run unless `TEST_DATABASE_IS_DISPOSABLE=1` and the test host is not the application database. The later browser checks are Playwright tests in `tests/browser`, using mocked festival, quote and checkout responses so they do not change stock.

## Money, ages and promos (automated, `src/domain`, `src/app/api/quote`)

| Case | Expected | Actual |
| --- | --- | --- |
| Ages 4 / 5 / 11 / 12 | under five / child / child / adult | Pass |
| 11 on Nov 10, turns 12, first attends Nov 13 (declared 12) | Adult ticket required | Pass |
| First attends at 11, birthday later in the festival | Child for all booked dates | Pass |
| Ages -1, 4.5, 151, "", "12abc", "1e1" | Rejected with a specific reason | Pass |
| Adult on 3 days | 3 × $15 = $45 | Pass |
| Family Pass on 2 dates | $80, one pass per date, no individual tickets | Pass |
| Under-five dinner | Entry free, dinner $12 | Pass |
| `FLAT20` on a $15 ticket | Rejected: needs a $20.00 subtotal | Pass |
| `FLAT20` on $15 ticket + $5 sticks | Total $0 | Pass |
| `KIDSFREE` with a Family Pass only | Rejected: "This code only applies to child tickets." | Pass |
| `KIDSFREE` with child Day/All-Day tickets | Only those tickets free | Pass |
| `SEVA10` | 10% of subtotal incl. extras, half cent rounds up | Pass |
| `EXPIRED5`, `MAXEDOUT`, unknown, `seva10` | Rejected with explanation, no discount | Pass |
| Browser-supplied `unitPriceCents` | `400` unexpected field | Pass |
| Family Pass with 3 adults + 1 child, or an under-five in a child place | Rejected | Pass |
| Extras on a day not attended, duplicates, sticks outside 0–10 | Rejected | Pass |
| Booking with no attendees; booker under 18 | Rejected | Pass |

## Checkout and stock (automated against PostgreSQL, `tests/integration`)

| Case | Expected | Actual |
| --- | --- | --- |
| Successful booking | Saved; stock deducted; receipt reopens by token | Pass |
| Same key retried | Same booking returned; stock deducted once | Pass |
| Same key sent twice at once (double-click) | One created, one replayed, one booking | Pass |
| Same key, different content | `key_conflict`, no second booking | Pass |
| Two bookings for the last 2 workshop places at once | Exactly one succeeds; stock 0 | Pass |
| One product short | Whole booking rolled back; no other stock used | Pass |
| Sold-out Adult All-Day Pass | Refused | Pass |
| Simulated decline | No stock used, no booking; same key can then succeed | Pass |
| Reviewed total no longer matches | `price_changed` with the new quote; no stock used | Pass |
| Valid $0 booking | Saved as free; stock still deducted | Pass |

## Booking flow (browser)

| Case | Expected | Actual |
| --- | --- | --- |
| Continue with nobody added | Error summary: "Add at least one person who is coming." | Pass |
| Continue with an empty person | "Enter a name.", "Choose at least one day." | Pass |
| Age field | Disabled until a day is chosen; label "Age on Tue 10 Nov (their first day)" | Pass |
| Ticket line updates with age 12 → 4 | Adult Day Pass → Free entry (under 5) | Pass |
| Adult picks All five days | "Adult: sold out" badge; Continue blocked with "Adult All-Day Pass is sold out." | Pass |
| Dinner grid | Checkbox only on attended days, otherwise "Not attending" | Pass |
| Untick a day that has a dinner | Dinner removed with notice explaining why; total refreshed | Pass |
| Promo `flat20` then `FLAT20` | Not recognised; then applied, total $0.00 | Pass |
| $0 total | "Confirm free booking", no payment choice; confirmation says free | Pass |
| Simulated decline, then success | Decline message; then confirmation "Simulated payment" | Pass |
| Confirmation reload | Same saved booking shown | Pass |
| Phone width (390px) | Single column, summary as bottom bar with "View summary" | Pass |
| Console errors during the flow | None | Pass |

Small issues found in that run were fixed afterwards and covered by unit tests or rechecked: the summary showed an error before anyone was added, the removal notice appeared at the top of the page, the expanded phone summary was slightly see-through, and "1 pairs" wording.

## Production (Vercel)

| Case | Expected | Actual |
| --- | --- | --- |
| `GET /api/health` on https://jkyog-booking.vercel.app | `200`, database ok | Pass |
| `GET /api/event` | `200` with starting stock | Pass |

## Follow-up checks (same day, after the review fixes)

| Case | Expected | Actual |
| --- | --- | --- |
| Unit and component tests | 157 passing, including checkout classification, sticks text, summary states, clipboard failure and the stock error's product ids | Pass |
| TypeScript, ESLint, Prettier | No errors | Pass |
| PostgreSQL integration | 11 passing on the disposable test branch; cleanup refused if that branch is the app database | Pass |
| Lost checkout response, reload, same key and body | Retry returns the saved booking response and does not send a new request | Pass, Playwright, desktop and 390px |
| Decline, then a different simulation | New key and the new choice | Pass |
| Uncertain result | Payment choice hidden; retry keeps the saved choice | Pass |
| Dinner sells out after it was selected | Checkbox stays and can be cleared; checkout sends product ids | Pass |
| Remove the only person | Summary amount becomes a dash, not the old total | Pass |
| Slow quote for an older age | Current total stays with the newer selection | Pass |
| Sticks `-1` and `1.0` | Text stays unchanged and an error is shown | Pass |
| Continue with nobody added | Error summary is focused; its link focuses Add a person; Enter adds a person and focuses the name | Pass |
| Family Pass with one adult | "Add one adult aged 12 or older." and "Add 2 children aged 5–11." | Pass |
| `FLAT20` after sticks are removed | The rejection and Remove code are shown, not "Applied" or "Updating total…" | Pass |
| Phone width | Continue button can sit above the summary bar | Pass |
| `npm run build` | Production build | Pass |

## Not checked

- A full keyboard-only pass and a screen-reader pass were not done by hand. Playwright checked the first error focus, the summary link, and Enter on Add a person.
- The live Vercel site was not redeployed, so the deployed booking flow was not run again.
- The Playwright receipt page is a stand-in response. Reopening a real saved receipt remains covered by the PostgreSQL test, not by a browser against production.
