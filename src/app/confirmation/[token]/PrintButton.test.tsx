/**
 * @jest-environment jsdom
 */
import { describe, expect, it } from "@jest/globals";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReceiptActions } from "./PrintButton";

describe("ReceiptActions", () => {
  it("offers the link to copy by hand when the clipboard refuses", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: () => Promise.reject(new Error("blocked")),
      },
    });

    render(<ReceiptActions />);
    fireEvent.click(screen.getByRole("button", { name: "Copy receipt link" }));

    const field = await screen.findByRole("textbox");
    expect(field).toBeTruthy();
    expect(screen.getByText(/couldn't be copied/)).toBeTruthy();
  });
});
