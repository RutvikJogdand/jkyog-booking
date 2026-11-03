import type {
  Attendee,
  FamilyGroup,
  FestivalDate,
} from "@/domain/booking/types";

export const DATE_LABELS: Record<FestivalDate, string> = {
  "2026-11-10": "Tue 10 Nov",
  "2026-11-11": "Wed 11 Nov",
  "2026-11-12": "Thu 12 Nov",
  "2026-11-13": "Fri 13 Nov",
  "2026-11-14": "Sat 14 Nov",
};

export function formatFestivalRange(dates: readonly FestivalDate[]): string {
  if (dates.length === 0) return "";
  const sorted = [...dates].sort();
  const start = new Date(`${sorted[0]}T12:00:00Z`);
  const end = new Date(`${sorted[sorted.length - 1]}T12:00:00Z`);
  const month = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    timeZone: "UTC",
  });
  if (
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth()
  ) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${month.format(end)} ${end.getUTCFullYear()}`;
  }
  const full = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${full.format(start)} – ${full.format(end)}`;
}

export function formatDates(dates: readonly FestivalDate[]): string {
  return [...dates]
    .sort()
    .map((date) => DATE_LABELS[date])
    .join(", ");
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatUsd(cents: number): string {
  return usd.format(cents / 100);
}

export function describeAdmission(
  attendee: Attendee,
  familyGroups: readonly FamilyGroup[],
): string {
  const { admission } = attendee;
  switch (admission.kind) {
    case "day":
      return `${admission.category === "adult" ? "Adult" : "Child"} Day Pass · ${formatDates(admission.dates)}`;
    case "all_days":
      return `${admission.category === "adult" ? "Adult" : "Child"} All-Day Pass · covers all five days, from a first visit on ${DATE_LABELS[attendee.firstVisitDate]}`;
    case "family": {
      const group = familyGroups.find((g) => g.id === admission.familyId);
      return `Family Pass · ${group ? formatDates(group.dates) : ""}`;
    }
    case "free":
      return `Free entry (under 5) · ${formatDates(admission.dates)}`;
  }
}
