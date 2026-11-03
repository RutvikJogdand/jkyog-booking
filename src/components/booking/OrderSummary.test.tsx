/**
 * @jest-environment jsdom
 */
import { describe, expect, it } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { OrderSummary } from "./OrderSummary";
import type { QuoteState } from "./use-quote";

const previous = {
  lines: [],
  subtotalCents: 1500,
  discountCents: 0,
  totalCents: 1500,
  currency: "USD" as const,
};

function state(overrides: Partial<QuoteState>): QuoteState {
  return {
    status: "idle",
    quote: null,
    lastQuote: null,
    error: null,
    retry: () => undefined,
    ...overrides,
  };
}

describe("OrderSummary", () => {
  it("does not keep an old amount after everyone is removed", () => {
    render(
      <OrderSummary
        quote={state({ status: "idle", lastQuote: previous })}
        promoCode="FLAT20"
        hasAttendees={false}
      />,
    );

    expect(screen.getByText("—")).toBeTruthy();
    expect(
      screen.getByText("Add the first person who's coming to see a price."),
    ).toBeTruthy();
    expect(screen.queryByText("$15.00")).toBeNull();
    expect(screen.queryByText("FLAT20")).toBeNull();
  });

  it("labels a total that is still refreshing as previous", () => {
    render(
      <OrderSummary
        quote={state({ status: "loading", lastQuote: previous })}
        promoCode={null}
        hasAttendees
      />,
    );

    expect(screen.getByText("Updating total…")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByText(/Previous total: \$15\.00/)).toBeTruthy();
  });

  it("shows a failed quote in the collapsed summary", () => {
    render(
      <OrderSummary
        quote={state({
          status: "error",
          error: { message: "We couldn't update the total.", fields: [] },
          lastQuote: previous,
        })}
        promoCode="FLAT20"
        hasAttendees
      />,
    );

    expect(
      screen.getAllByText("We couldn't update the total.").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("Applied")).toBeNull();
  });
});
