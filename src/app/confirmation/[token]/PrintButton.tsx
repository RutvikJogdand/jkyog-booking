"use client";

import { useState } from "react";
import styles from "@/components/booking/booking.module.css";

export function ReceiptActions() {
  const [copied, setCopied] = useState(false);
  const [manualLink, setManualLink] = useState<string | null>(null);

  async function copyLink() {
    const href = window.location.href;
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setManualLink(null);
    } catch {
      setCopied(false);
      setManualLink(href);
    }
  }

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
        onClick={() => void copyLink()}
      >
        Copy receipt link
      </button>
      <span role="status">{copied ? "Link copied." : ""}</span>
      {manualLink !== null && (
        <label className={styles.field}>
          The link couldn&apos;t be copied automatically. Select it here:
          <input
            className={styles.input}
            readOnly
            value={manualLink}
            onFocus={(e) => e.currentTarget.select()}
          />
        </label>
      )}
    </div>
  );
}
