"use client";

import { useState } from "react";
import styles from "@/components/booking/booking.module.css";

export function ReceiptActions() {
  const [copied, setCopied] = useState(false);
  return (
    <div className={`${styles.actions} no-print`}>
      <button
        type="button"
        className={styles.primaryButton}
        onClick={() => window.print()}
      >
        Print
      </button>
      <button
        type="button"
        className={styles.secondaryButton}
        onClick={() => {
          void navigator.clipboard
            .writeText(window.location.href)
            .then(() => setCopied(true));
        }}
      >
        Copy receipt link
      </button>
      <span role="status">{copied ? "Link copied." : ""}</span>
    </div>
  );
}
