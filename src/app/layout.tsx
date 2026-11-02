import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Sharad Utsav 2026 — Booking",
  description:
    "Book entry and extras for Sharad Utsav 2026 at Radha Krishna Temple, Allen, Texas.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
