import { Temporal } from "@js-temporal/polyfill";
import { trustedBookingUrl } from "./booking";
import type { OutingPlan } from "./plans";

export function calendarText(value: string): string {
  return value.replace(/\\/gu, "\\\\").replace(/\r\n|\r|\n/gu, "\\n").replace(/;/gu, "\\;").replace(/,/gu, "\\,").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/gu, "");
}

/** Fold by UTF-8 bytes without splitting a Unicode character (RFC 5545). */
export function foldCalendarLine(line: string): string {
  const encoder = new TextEncoder();
  let current = "", bytes = 0;
  const lines: string[] = [];
  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > 75) { lines.push(current); current = " "; bytes = 1; }
    current += char; bytes += size;
  }
  lines.push(current);
  return lines.join("\r\n");
}

export function calendarInstant(value: string): string | null {
  try {
    const instant = /(?:Z|[+-]\d{2}:\d{2})$/u.test(value)
      ? Temporal.Instant.from(value)
      : Temporal.PlainDateTime.from(value).toZonedDateTime("Pacific/Auckland", { disambiguation: "reject" }).toInstant();
    return instant.toString({ smallestUnit: "second" }).replace(/[-:]/gu, "");
  } catch { return null; }
}

export function planCalendar(plan: OutingPlan): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//KiwiCue//Outing plan//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  plan.cards.forEach((card, index) => {
    const start = calendarInstant(card.when);
    if (!start) return;
    lines.push("BEGIN:VEVENT", `UID:${plan.id}-${index}@kiwicue.nz`, `DTSTAMP:${calendarInstant(plan.createdAt)}`,
      `DTSTART:${start}`, `SUMMARY:${calendarText(card.title)}`, `LOCATION:${calendarText(card.venue ?? "")}`);
    if (card.durationMinutes) {
      const end = Temporal.Instant.from(start).add({ minutes: card.durationMinutes });
      lines.push(`DTEND:${calendarInstant(end.toString())}`);
    }
    lines.push(`DESCRIPTION:${calendarText(`${plan.notes}\nPrices and availability must be checked with the official source. Travel time is not included.`)}`);
    const url = trustedBookingUrl(card.bookingUrl);
    if (url) lines.push(`URL:${url}`);
    lines.push("END:VEVENT");
  });
  return [...lines, "END:VCALENDAR"].map(foldCalendarLine).join("\r\n") + "\r\n";
}
