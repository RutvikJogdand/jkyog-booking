import styles from "./booking.module.css";

export function IssueList({ messages }: { messages: readonly string[] }) {
  if (messages.length === 0) return null;
  return (
    <ul className={styles.errorList}>
      {messages.map((message) => (
        <li key={message} className={styles.error}>
          <strong>Error:</strong> {message}
        </li>
      ))}
    </ul>
  );
}
