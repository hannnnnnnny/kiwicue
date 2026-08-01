import type { Language } from "../components/language-provider";

const timePending = { en: "Time to be confirmed", zh: "时间待定" } as const;
const statuses = {
  en: {
    onsale: "On sale",
    offsale: "Off sale",
    cancelled: "Cancelled",
    postponed: "Postponed",
    rescheduled: "Rescheduled",
  },
  zh: {
    onsale: "售票中",
    offsale: "停止售票",
    cancelled: "已取消",
    postponed: "已延期",
    rescheduled: "已改期",
  },
} as const;

export function formatEventDate(localDate: string, language: Language): string {
  const [year, month, day] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (language === "zh") {
    const weekday = new Intl.DateTimeFormat("zh-CN", {
      weekday: "short",
      timeZone: "UTC",
    }).format(date);
    return `${month}月${day}日${weekday}`;
  }
  return new Intl.DateTimeFormat("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

export function formatEventTime(localTime: string | null, language: Language): string {
  if (!localTime) return timePending[language];
  const [hour, minute] = localTime.split(":").map(Number);
  if (language === "zh") {
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
  return new Intl.DateTimeFormat("en-NZ", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(1970, 0, 1, hour, minute))).toLowerCase();
}

export function formatEventStatus(status: string, language: Language): string {
  const known = statuses[language] as Record<string, string>;
  const label = known[status];
  if (label) return label;
  const normalized = status.replaceAll("_", " ");
  return language === "en"
    ? normalized.replace(/\b\w/g, (letter) => letter.toUpperCase())
    : normalized;
}
