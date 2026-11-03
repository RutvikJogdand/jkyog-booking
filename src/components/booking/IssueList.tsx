import styles from "./booking.module.css";

export function IssueList({
  id,
  messages,
}: {
  id?: string;
  messages: readonly string[];
}) {
  if (messages.length === 0) return null;
  return (
    <ul id={id} className={styles.errorList}>
      {messages.map((message) => (
        <li key={message} className={styles.error}>
          <strong>Error:</strong> {message}
        </li>
      ))}
    </ul>
  );
}
