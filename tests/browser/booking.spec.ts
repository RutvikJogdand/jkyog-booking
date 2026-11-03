import { expect, test, type Page, type Route } from "@playwright/test";

const DATES = [
  "2026-11-10",
  "2026-11-11",
  "2026-11-12",
  "2026-11-13",
  "2026-11-14",
] as const;

const PRODUCTS = [
  ["day_adult", "Adult Day Pass", 1500],
  ["day_child", "Child Day Pass", 800],
  ["all_days_adult", "Adult All-Day Pass", 6000],
  ["all_days_child", "Child All-Day Pass", 3000],
  ["family", "Family Pass", 4000],
  ["dandiya_sticks", "Dandiya Sticks", 500],
  ["dinner_plate", "Dinner Plate", 1200],
  ["garba_workshop", "Garba Workshop", 2000],
] as const;

function eventBody(stock: Record<string, number> = {}) {
  return {
    event: {
      name: "Sharad Utsav 2026",
      venue: "Radha Krishna Temple, Allen, Texas",
      dates: DATES,
      currency: "USD",
    },
    products: PRODUCTS.map(([id, name, unitPriceCents]) => ({
      id,
      name,
      unitPriceCents,
    })),
    availability: Object.fromEntries(
      PRODUCTS.map(([id]) => [id, stock[id] ?? 20]),
    ),
  };
}

function quoteBody(totalCents: number) {
  return {
    lines: [
      {
        productId: "day_adult",
        description: "Adult Day Pass",
        quantity: 1,
        unitPriceCents: totalCents,
        amountCents: totalCents,
      },
    ],
    subtotalCents: totalCents,
    discountCents: 0,
    totalCents,
    currency: "USD",
  };
}

const receiptToken = "a".repeat(43);

function successBody() {
  return {
    bookingId: "SU-23456789",
    receiptPath: `/confirmation/${receiptToken}`,
    quote: quoteBody(1500),
  };
}

async function installApi(page: Page, options?: { dinnerLeft?: number }) {
  const bookings: { key: string | null; body: string }[] = [];
  let eventCalls = 0;
  await page.route("**/api/**", (route) => route.abort());
  await page.route("**/api/event", (route) => {
    eventCalls += 1;
    const dinner = options?.dinnerLeft ?? 20;
    return route.fulfill({
      json: eventBody({
        all_days_adult: 0,
        dinner_plate: eventCalls === 1 ? dinner : 0,
        garba_workshop: 2,
      }),
    });
  });
  await page.route("**/api/quote", async (route) => {
    const body = route.request().postDataJSON() as {
      selection: { promoCode?: string; extras: { sticksPairs: number } };
    };
    if (
      body.selection.promoCode === "FLAT20" &&
      body.selection.extras.sticksPairs === 0
    ) {
      return route.fulfill({
        status: 422,
        json: {
          error: {
            code: "invalid_selection",
            message: "Some booking details need fixing.",
            fields: [
              {
                path: "selection.promoCode",
                message: "FLAT20 needs a subtotal of at least $20.00.",
              },
            ],
          },
        },
      });
    }
    return route.fulfill({
      json: quoteBody(body.selection.extras.sticksPairs > 0 ? 2000 : 1500),
    });
  });
  await page.route("**/api/bookings", async (route) => {
    bookings.push({
      key: route.request().headers()["idempotency-key"] ?? null,
      body: route.request().postData() ?? "",
    });
    return route.fulfill({ status: 201, json: successBody() });
  });
  await page.route("**/confirmation/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<h1>Booking confirmed</h1><p>Booking reference: SU-23456789</p>",
    }),
  );
  return { bookings, eventCalls: () => eventCalls };
}

async function addAdult(page: Page, name = "Asha") {
  await page.getByRole("button", { name: "Add a person" }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("checkbox", { name: "Tue 10 Nov" }).check();
  await page.getByLabel(/Age on Tue 10 Nov/).fill("30");
}

async function reachPayment(page: Page) {
  await addAdult(page);
  await page.getByRole("button", { name: "Continue to extras" }).click();
  await page.getByLabel("Your name").fill("Priya");
  await page.getByLabel("Email").fill("priya@example.com");
  await page.getByLabel("Your age today").fill("35");
  await page.getByRole("button", { name: "Review booking" }).click();
  await expect(page.getByText("$15.00").first()).toBeVisible();
  await page.getByRole("button", { name: "Continue to payment" }).click();
}

test.beforeEach(async ({ page }) => {
  await installApi(page);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Sharad Utsav 2026" }),
  ).toBeVisible();
});

test("keeps the same checkout key after a lost response and a reload", async ({
  page,
}) => {
  const seen: { key: string | null; body: string }[] = [];
  await page.route("**/api/bookings", async (route) => {
    const attempt = {
      key: route.request().headers()["idempotency-key"] ?? null,
      body: route.request().postData() ?? "",
    };
    seen.push(attempt);
    if (seen.length === 1) {
      return route.fulfill({ status: 200, body: "not-json" });
    }
    return route.fulfill({ status: 201, json: successBody() });
  });

  await reachPayment(page);
  await page.getByRole("button", { name: "Pay $15.00 (simulated)" }).click();
  await expect(
    page.getByRole("button", { name: "Retry the same checkout" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "1. People and tickets" })
    .click({ force: true });
  await expect(
    page.getByRole("heading", { name: /Finish this checkout/ }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Retry the same checkout" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry the same checkout" }).click();
  await expect(
    page.getByRole("heading", { name: "Booking confirmed" }),
  ).toBeVisible();
  expect(seen).toHaveLength(2);
  expect(seen[1]?.key).toBe(seen[0]?.key);
  expect(seen[1]?.body).toBe(seen[0]?.body);
});

test("allows a new payment choice after a decline, and keeps it during an uncertain result", async ({
  page,
}) => {
  const seen: { key: string | null; body: string }[] = [];
  await page.route("**/api/bookings", async (route) => {
    seen.push({
      key: route.request().headers()["idempotency-key"] ?? null,
      body: route.request().postData() ?? "",
    });
    return route.fulfill({
      status: 402,
      json: {
        error: {
          code: "payment_declined",
          message: "Payment declined (simulated).",
          fields: [],
        },
      },
    });
  });

  await reachPayment(page);
  await page.getByLabel("Payment is declined").check();
  await page.getByRole("button", { name: "Pay $15.00 (simulated)" }).click();
  await expect(page.getByText("Payment declined (simulated).")).toBeVisible();
  await page.getByLabel("Payment succeeds").check();
  await page.getByRole("button", { name: "Pay $15.00 (simulated)" }).click();
  expect(seen[0]?.body).toContain('"simulation":"decline"');
  expect(seen[1]?.body).toContain('"simulation":"success"');
  expect(seen[0]?.key).not.toBe(seen[1]?.key);

  await page.route("**/api/bookings", async (route) => {
    seen.push({
      key: route.request().headers()["idempotency-key"] ?? null,
      body: route.request().postData() ?? "",
    });
    return route.fulfill({ status: 200, body: "{" });
  });
  await page.getByRole("button", { name: "Pay $15.00 (simulated)" }).click();
  await expect(
    page.getByRole("button", { name: "Retry the same checkout" }),
  ).toBeVisible();
  await expect(page.getByLabel("Payment is declined")).toHaveCount(0);
  const before = seen.length;
  await page.getByRole("button", { name: "Retry the same checkout" }).click();
  expect(seen[before]?.body).toBe(seen[before - 1]?.body);
  expect(seen[before]?.key).toBe(seen[before - 1]?.key);
});

test("keeps a sold-out dinner removable", async ({ page }) => {
  await page.unroute("**/api/event");
  let dinnerLeft = 5;
  await page.route("**/api/event", (route) =>
    route.fulfill({
      json: eventBody({ all_days_adult: 0, dinner_plate: dinnerLeft }),
    }),
  );
  await page.reload();
  await page.route("**/api/bookings", (route) =>
    route.fulfill({
      status: 409,
      json: {
        error: {
          code: "out_of_stock",
          message: "Not enough left: Dinner Plate.",
          fields: [],
          productIds: ["dinner_plate"],
        },
      },
    }),
  );

  await reachPayment(page);
  await page.getByRole("button", { name: "2. Extras and contact" }).click();
  await page.getByRole("checkbox", { name: /Tue 10 Nov/ }).check();
  await page.getByRole("button", { name: "Review booking" }).click();
  await expect(page.getByText("Updating total…")).toHaveCount(0);
  await page.getByRole("button", { name: "Continue to payment" }).click();
  dinnerLeft = 0;
  await page
    .getByRole("button", { name: /Pay \$|Confirm free booking/ })
    .click();
  await expect(
    page.getByRole("heading", { name: /Extras and contact/ }),
  ).toBeVisible();
  const dinner = page.getByRole("checkbox", { name: /Tue 10 Nov/ });
  await expect(dinner).toBeChecked();
  await dinner.uncheck();
  await expect(dinner).not.toBeChecked();
});

test("clears the summary amount when nobody is coming", async ({ page }) => {
  await addAdult(page);
  await expect(page.getByText("$15.00").first()).toBeVisible();
  await page.getByRole("button", { name: "Remove Asha" }).click();
  await expect(
    page.getByText("Add the first person who's coming to see a price."),
  ).toBeVisible();
  await expect(
    page.locator(".summaryTotal, [class*='summaryTotal']"),
  ).toHaveText("—");
});

test("ignores a slow quote that answers an older selection", async ({
  page,
}) => {
  const held: { route: Route | null } = { route: null };
  let quotes = 0;
  await page.route("**/api/quote", async (route) => {
    quotes += 1;
    if (quotes === 1) {
      held.route = route;
      return;
    }
    return route.fulfill({ json: quoteBody(800) });
  });

  await page.getByRole("button", { name: "Add a person" }).click();
  await page.getByLabel("Name").fill("Asha");
  await page.getByRole("checkbox", { name: "Tue 10 Nov" }).check();
  await page.getByLabel(/Age on/).fill("30");
  await expect.poll(() => quotes).toBeGreaterThan(0);
  await page.getByLabel(/Age on/).fill("8");
  await expect.poll(() => quotes).toBe(2);
  if (held.route === null) throw new Error("The first quote was not held.");
  await held.route.fulfill({ json: quoteBody(1500) });
  const summary = page.getByRole("complementary");
  await expect(summary.locator("[class*='summaryTotal']")).toHaveText("$8.00");
  await expect(summary.getByText("$15.00")).toHaveCount(0);
});

test("rejects sticks text that is not a whole number", async ({ page }) => {
  await addAdult(page);
  await page.getByRole("button", { name: "Continue to extras" }).click();
  const sticks = page.locator("#sticks");
  await sticks.fill("-1");
  await expect(sticks).toHaveValue("-1");
  await expect(page.getByText(/whole number of pairs/)).toBeVisible();
  await sticks.fill("1.0");
  await expect(sticks).toHaveValue("1.0");
  await expect(page.getByText(/whole number of pairs/)).toBeVisible();
});

test("moves focus to the error summary and then to the action", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Continue to extras" }).click();
  await expect(page.locator("#error-summary")).toBeFocused();
  await page.getByRole("button", { name: /Add at least one person/ }).click();
  await expect(page.locator("#add-person")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Name")).toBeFocused();
});

test("explains what a Family Pass still needs", async ({ page }) => {
  await page.getByRole("button", { name: "Start a Family Pass" }).click();
  await page.getByRole("checkbox", { name: "Tue 10 Nov" }).check();
  await page.getByRole("button", { name: "Add a member" }).click();
  await page.getByLabel("Name").fill("Asha");
  await page.getByLabel(/Age on Tue 10 Nov/).fill("30");
  await expect(page.getByText("Add one adult aged 12 or older.")).toBeVisible();
  await expect(page.getByText("Add 2 children aged 5–11.")).toBeVisible();
});

test("shows a promo rejection instead of an updating total", async ({
  page,
}) => {
  await addAdult(page);
  await page.getByRole("button", { name: "Continue to extras" }).click();
  await page.locator("#sticks").fill("1");
  await page.getByLabel("Your name").fill("Priya");
  await page.getByLabel("Email").fill("priya@example.com");
  await page.getByLabel("Your age today").fill("35");
  await page.getByRole("button", { name: "Review booking" }).click();
  await page.getByLabel("Code (optional)").fill("FLAT20");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText(/Applied:/)).toBeVisible();
  await page.getByRole("button", { name: "2. Extras and contact" }).click();
  await page.locator("#sticks").fill("0");
  await page.getByRole("button", { name: "Review booking" }).click();
  await expect(
    page.getByText("FLAT20 needs a subtotal of at least $20.00.").first(),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove code" })).toBeVisible();
  await expect(page.getByText("Updating total…")).toHaveCount(0);
  await expect(page.getByText(/^Applied:/)).toHaveCount(0);
});

test("keeps the summary bar from covering the primary button on a phone", async ({
  page,
}) => {
  test.skip(test.info().project.name !== "mobile", "phone layout only");
  const button = page.getByRole("button", { name: "Continue to extras" });
  const summary = page.getByRole("complementary");
  await button.evaluate((element) =>
    element.scrollIntoView({ block: "center", inline: "nearest" }),
  );
  const buttonBox = await button.boundingBox();
  const summaryBox = await summary.boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(summaryBox).not.toBeNull();
  expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(
    summaryBox!.y + 2,
  );
});
