# Sharad Utsav — UI design

This describes the screens, layout and interaction design. Business rules come from `docs/PRD.md`; architecture, API shapes and form state come from `docs/TECHNICAL.md`. Where this document makes a choice those files do not, it is marked **Proposal** so it can be reviewed. Unresolved items are listed in section 9.

Decisions confirmed for this document:

- A step-by-step wizard with a persistent order summary.
- System font stacks only; no web fonts.
- No logo, imagery or reference screenshots were supplied; only the colour tokens in PRD section 7.
- A dark page with cream cards.

## 1. Screens and routes

| Route | Screen |
| --- | --- |
| `/` | Event header plus the booking wizard (steps 1–4) and order summary. |
| `/confirmation/[token]` | Saved, printable confirmation (step 5). |

Wizard steps follow PRD section 2:

1. **Attendees** — people, ages, tickets, attendance dates and Family Pass groups.
2. **Extras and contact** — Dandiya Sticks, Dinner Plates, Garba Workshop and the booker's details.
3. **Review** — promo code and itemized total.
4. **Payment** — simulated payment, or confirm a valid free booking.

Step 5 is the confirmation page, reached after a successful checkout.

## 2. Page layout

**Header** (all screens): event name, "Radha Krishna Temple, Allen, Texas" and "10–14 November 2026", loaded from `GET /api/event`.

**Wizard area**:

- A step indicator listing the four steps with their names and "Step N of 4" text. Completed steps are buttons, so people can go back and edit (PRD section 2). Later steps are not clickable until earlier steps pass client-side checks.
- The current step's heading receives focus when the step changes, so keyboard and screen-reader users land at the new content.
- **Back** and **Continue** buttons at the bottom of each step. Continue runs that step's client-side checks. These are feedback only; the server still enforces every rule.

**Order summary**:

- **Proposal:** on wide screens, a sticky sidebar to the right of the wizard. On phones, a sticky bottom bar showing the total and a "View summary" button that expands the full summary in place. The breakpoint will be chosen during implementation and checked on a real phone.
- It shows only the latest server quote: tickets, extras, subtotal, savings and total, as listed in PRD section 5. Components never calculate the final price (TECHNICAL section 3).
- Before anyone is added: "Add the first person who's coming to see a price."
- While a quote is refreshing: "Updating total…", announced politely to screen readers. The previous figures are visibly marked as out of date, and confirmation is disabled (TECHNICAL section 8).
- If a quote request fails: "We couldn't update the total." with a **Try again** button. Entered details are kept.

## 3. Step 1 — Attendees

### Attendee card

One card per person, added with **Add a person**. Fields in order:

1. **Name** — required.
2. **How will they attend?** — radio group:
   - "Choose days" (Day Pass, or free entry for under-fives)
   - "All five days" (All-Day Pass)
   - "With a Family Pass group"
3. **Dates**, depending on the choice above:
   - *Choose days:* one checkbox per festival date (Tue 10 Nov … Sat 14 Nov). The first visit is the earliest checked date and is shown as text, for example "First day: Wed 11 Nov". TECHNICAL section 4 requires the first visit to equal the earliest selected date.
   - *All five days:* the text "Covers all five days" plus a **First day they'll come** select. The pass always covers all five dates (PRD section 3); the first day is used only to interpret their age.
   - *Family Pass:* a select listing the booking's family groups. The member's dates are shown read-only from the group.
4. **Age on {first day}** — whole-number input. The label includes the actual date, with the hint: "Enter their age on the day they first attend the festival, not today's age." It is disabled until a first day is known.
5. **Ticket** — read-only result line, derived from the age category and choice. Examples: "Child Day Pass · $8 per day · 2 days" and "Free entry (under 5)". Unit prices come from the `GET /api/event` catalogue; the total comes only from the quote.

Age categories (PRD section 4): under 5 means free entry, 5–11 means child admission and 12+ means adult admission.

Rules shown in the card:

- **Sold out:** Adult All-Day Pass starts with 0 stock. Its option stays visible but is disabled, with the text "Sold out" next to it, not just greyed out. Any other product that reaches zero is shown the same way.
- **Under 5 with "All five days":** free entry with all five dates selected. There is no under-five All-Day product.
- **Under 5 with "With a Family Pass group":** inline error: "Children under 5 come free and don't fill one of the two child places. Choose 'Choose days' instead."
- **Invalid ages:** a negative, fractional, non-numeric or empty age is rejected with a specific message. An empty field is never treated as 0, and "12abc" is never treated as 12 (TECHNICAL section 3).
- **First day changes:** if an age was already entered, show the inline prompt "Their first day is now {date}. Check their age for that day." with a **The age is correct** button. Continue is blocked until it is confirmed or the age is edited (PRD section 6). **Proposal:** keep the entered age rather than clearing it.
- **Remove person:** removes their dinner and workshop selections, then shows a removal notice (section 6).

### Family Pass groups

- **Add a Family Pass** creates a group card with a checkbox per festival date. Each checked date is one $40 pass (PRD section 3).
- The group card shows its members by listing the attendees who chose that group. There is no separate member list to edit (TECHNICAL section 4).
- Composition status is written as text, for example "Adults: 2 of 2 · Children: 1 of 2 — add 1 child aged 5–11". It never relies on colour alone.
- Continue is blocked until each group has exactly two adults (12+) and two children (5–11).

## 4. Step 2 — Extras and contact

### Extras

- **Dandiya Sticks** ($5 per pair): one quantity input for the booking, with decrement and increment buttons.
  - Whole numbers from 0 to 10 pairs, and never more than the remaining stock.
  - The buttons have accessible labels ("Remove a pair", "Add a pair"). The decrement button is disabled at 0, and the increment button at 10 or at the remaining stock.
  - Typed values outside the range show an error: "Choose between 0 and 10 pairs." or "Only N pairs left."
- **Dinner Plate** ($12 per person, per date): a grid of attendees × festival dates with one checkbox per cell. At most one plate per attendee per attendance date.
  - Only dates the attendee is attending have a checkbox. Other cells read "Not attending".
  - Someone attending three days can choose up to three plates, one per day. Different attendees can each have a plate on the same date.
  - Under-fives can choose dinners at the normal price, with the note: "Entry is free for under-fives; extras are charged normally."
- **Garba Workshop** ($20 per person, per session): Nov 11 and Nov 13 only, shown as one checkbox per session for each eligible attendee.
  - At most one place per attendee per session. One attendee may choose both sessions, for $40.
  - A session's checkbox appears only if the attendee's admission covers that date. All-Day Pass holders are covered on both dates, except dates before their declared first day (TECHNICAL section 4).
  - Both sessions share the same 2 places. Shared availability is shown as text, for example "2 places left across both sessions."
  - Once the booking's selections use up the remaining places, the other workshop checkboxes are disabled with "No places left". When none remain at all, it shows "Sold out".

### Contact details

- **Your name**, **Email**, **Your age today** and **Phone (optional)**.
- Hint: "You don't need to attend. If you are coming, add yourself as a person in step 1."
- Validation messages: "Enter an email like name@example.com" and "The person booking must be 18 or older."

## 5. Steps 3–5 — Review, payment and confirmation

### Step 3 — Review

- **Who's coming:** each attendee with their ticket, dates and extras. Each section has an **Edit** link back to the relevant step.
- **Promo code** field with an **Apply** button:
  - One code per booking. Applying a new code replaces the current one, and a **Remove** button clears it.
  - Messages use the PRD section 5 wording: expired, usage limit reached, not recognised, and `FLAT20` below the $20 minimum.
  - A successful code shows its name and the savings line in the summary.
- An itemized quote with ticket lines, extra lines, subtotal, savings and total.

### Step 4 — Payment

- A banner at the top: "Demo payment. No card details are collected and no real money is charged."
- For a positive total, a **Simulated result** radio group: "Payment succeeds" or "Payment is declined". The button reads **Pay $X (simulated)**.
- For a valid $0 total, no simulation choice is shown. The button reads **Confirm free booking**.
- While submitting, the button reads "Processing…" and is disabled to prevent double submission. The idempotency key still protects retries.

Outcomes, keeping all entered details in every case:

| Response | What the person sees |
| --- | --- |
| `402` decline | "Payment declined (simulated). Nothing was charged and no tickets were reserved." with **Try again**. |
| `409` price changed | "The total changed from $A to $B." Returns to Review for a fresh confirmation. |
| `409` stock shortage | Names the item that ran out, for example "Garba Workshop on 13 Nov is now full", with a link to the step where it was chosen. |
| `422` rule failure | An error summary linking each `fields[].path` to its field and step (section 6). |
| Timeout or network failure | "We couldn't confirm whether your booking went through. Retrying is safe — you won't be booked twice." **Retry** reuses the same key and content (TECHNICAL section 8). |

### Step 5 — Confirmation (`/confirmation/[token]`)

- The booking reference, attendees with dates and tickets, extras, promo, itemized quote, total and payment mode ("Simulated payment" or "Free booking").
- The booker's contact details are not shown (PRD section 6).
- A **Print** button, and a copyable receipt link that reopens the saved booking.
- **Print styles:** a light background with dark text. Hide the buttons and step navigation.
- An unknown token (`404`) shows "We couldn't find this booking. Check the link." with a link back to the booking page.

## 6. Errors, notices and states

- **Field errors** appear below the field, start with an error icon and the word "Error:", and explain how to fix the problem (PRD section 7).
- **Error summary:** when Continue or checkout fails, a summary at the top of the step lists each problem as a link that moves focus to the field. Server paths such as `selection.attendees.0.ageAtFirstVisit` map to the right step, card and field.
- **Removal notices:** when a person or date is removed, show a dismissible notice naming what was removed and why, then refresh the quote (PRD section 6). Example: "Removed Asha's Dinner Plate on Thu 12 Nov because she's no longer attending that day." Announced politely to screen readers.
- **Event loading:** placeholder cards. If `GET /api/event` fails: "We couldn't load the festival details." with **Try again**.
- **Empty attendees:** "No one added yet." with the **Add a person** button.

## 7. Visual system

Colour tokens are from PRD section 7. Contrast ratios were calculated with the WCAG relative-luminance formula. The targets are 4.5:1 for normal text and 3:1 for large text and essential non-text UI.

| Use | Foreground → background | Ratio |
| --- | --- | ---: |
| Page background | `primaryDark` `#2C2C2C` | — |
| Text on the page (outside cards) | `cream` on `primaryDark` | 12.71 |
| Gold accent text on the page | `brightGold` on `primaryDark` | 6.44 |
| Card headings | `heading` on `cream` | 15.50 |
| Card body text | `primary-text` on `cream` | 6.40 |
| Primary button | `primaryDark` text on `brightGold` | 6.44 |
| Focus ring on dark | `brightGold` around elements | 6.44 |
| Focus ring on cream | `primaryDark` around elements | 12.71 |

Cards:

- Cream cards on the dark page.
- **Proposal:** for the "translucent cards" requirement, use at least 90% cream opacity. At 90% over `#2C2C2C`, body text measures 5.33 and headings 12.91. Lower opacity must be checked again.

Contrast constraints found:

- **Gold on cream fails** (`primary` 2.33, `gold` 2.63, `brightGold` 1.97). On cream cards, gold may be decorative only, such as dividers or a card's top border. It is not used for text, focus rings or as the only boundary of a control.
- `primary-text` and `heading` fail on the dark page (1.99 and 1.22), so they are used only inside cream cards.
- **White on gold fails** (2.56). Gold buttons always use dark text.
- `error` `#EF1F1F` on cream is 3.91. That passes for icons and borders, but not for normal-size text. Error message text uses `heading` colour, with a red icon and a red left border carrying the colour cue.
- `success` `#28A736` on cream is 2.87, below even the 3:1 threshold. On cream, success text uses `heading` colour and always includes words such as "Applied" or "Confirmed", so the green icon is supplementary. On the dark page, `success` measures 4.44, which suits large text and icons but not normal-size text.

Typography (system stacks, as confirmed):

- Headings: `ui-serif, Georgia, Cambria, "Times New Roman", Times, serif`.
- Body: `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`.

Colours, spacing and radii live in shared CSS variables, used by CSS Modules (TECHNICAL section 1).

## 8. Components

The planned files are in `src/components/booking/` (TECHNICAL section 2). Each is created when its step is built.

| Component | Responsibility |
| --- | --- |
| `BookingWizard` | Holds the reducer state, current step and navigation. |
| `StepIndicator` | Step list and "Step N of 4". |
| `AttendeesStep`, `AttendeeCard`, `FamilyGroupCard` | Step 1. |
| `ExtrasStep`, `DinnerGrid`, `WorkshopPicker`, `ContactForm` | Step 2. |
| `ReviewStep`, `PromoField` | Step 3. |
| `PaymentStep` | Step 4 and checkout outcomes. |
| `OrderSummary` | Sidebar or bottom bar showing the latest server quote. |
| `ErrorSummary`, `FieldError`, `RemovalNotice` | Shared feedback. |

The confirmation view lives in `src/app/confirmation/[token]/page.tsx`.

## 9. Open questions

The extra-quantity limits are settled; see PRD section 3 and the README's "Decisions I made". These proposals still need review:

1. When a first day changes, keep the entered age and ask for confirmation (section 3), rather than clearing it.
2. A wide-screen sidebar and a phone bottom-bar summary (section 2).
3. At least 90% opacity for cream cards (section 7).
