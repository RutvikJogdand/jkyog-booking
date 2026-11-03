import type { Quote } from "@/domain/booking/types";
import styles from "./booking.module.css";
import { formatUsd } from "./format";

export function QuoteTable({
  quote,
  promoCode,
  caption,
}: {
  quote: Quote;
  promoCode?: string | null;
  caption: string;
}) {
  return (
    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <caption className={styles.srOnly}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col" className={styles.amount}>
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {quote.lines.map((line) => (
            <tr key={line.productId}>
              <td>
                {line.description} × {line.quantity}
                <br />
                <span className={styles.muted}>
                  {formatUsd(line.unitPriceCents)} each
                </span>
              </td>
              <td className={styles.amount}>{formatUsd(line.amountCents)}</td>
            </tr>
          ))}
          <tr>
            <td>Subtotal</td>
            <td className={styles.amount}>{formatUsd(quote.subtotalCents)}</td>
          </tr>
          {quote.discountCents > 0 && (
            <tr>
              <td>Savings{promoCode ? ` (${promoCode})` : ""}</td>
              <td className={styles.amount}>
                −{formatUsd(quote.discountCents)}
              </td>
            </tr>
          )}
          <tr className={styles.totalRow}>
            <td>Total</td>
            <td className={styles.amount}>{formatUsd(quote.totalCents)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
