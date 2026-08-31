import type { Language } from "../components/language-provider";
import { isRecurringMarketEvent, type KiwiCueEvent, type KiwiCueEventDetail } from "./events";

const timePending = { en: "Time to be confirmed", zh: "时间待定" } as const;
const statuses = {
  en: {
    onsale: "On sale",
    offsale: "Off sale",
    cancelled: "Cancelled",
    postponed: "Postponed",
    rescheduled: "Rescheduled",
    schedule_verified: "Schedule verified",
  },
  zh: {
    onsale: "售票中",
    offsale: "停止售票",
    cancelled: "已取消",
    postponed: "已延期",
    rescheduled: "已改期",
    schedule_verified: "日程已核实",
  },
} as const;

const RECURRING_SOURCE_MAX_AGE_DAYS = 120;
const recurringScheduleStatus = {
  en: { fresh: "Expected schedule", stale: "Schedule reference may be stale" },
  zh: { fresh: "预计日程", stale: "日程参考可能已过期" },
} as const;

const categories = {
  zh: {
    "Arts & Theatre": "艺术与剧场",
    Film: "电影",
    Miscellaneous: "其他",
    Music: "音乐",
    Market: "市集",
    Sports: "体育",
    Undefined: "其他",
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

export function isEventSourceFresh(verifiedAt: string | undefined, now = new Date()): boolean {
  if (!verifiedAt || !Number.isFinite(now.getTime())) return false;
  const verifiedTime = Date.parse(`${verifiedAt}T00:00:00Z`);
  if (!Number.isFinite(verifiedTime)) return false;
  const ageDays = Math.floor((now.getTime() - verifiedTime) / 86_400_000);
  return ageDays >= 0 && ageDays <= RECURRING_SOURCE_MAX_AGE_DAYS;
}

export function formatEventStatusForDisplay(
  event: KiwiCueEvent,
  language: Language,
  now = new Date(),
): string {
  if (!isRecurringMarketEvent(event)) return formatEventStatus(event.status, language);
  const status = recurringScheduleStatus[language];
  return isEventSourceFresh(event.source?.verifiedAt, now) ? status.fresh : status.stale;
}

export function formatEventCategory(category: string, language: Language): string {
  if (language === "en") return category;
  return (categories.zh as Record<string, string>)[category] ?? category;
}

export function eventDisplayName(event: KiwiCueEvent, language: Language): string {
  return language === "zh" ? event.localization?.zh?.name ?? event.name : event.name;
}

export function eventDisplayDescription(event: KiwiCueEventDetail, language: Language): string | null {
  return language === "zh"
    ? event.localization?.zh?.description ?? event.description ?? null
    : event.description ?? null;
}

export function eventDisplayNote(event: KiwiCueEventDetail, language: Language): string | null {
  return language === "zh"
    ? event.localization?.zh?.note ?? event.note ?? null
    : event.note ?? null;
}

export function formatVerifiedDate(localDate: string, language: Language): string {
  const [year, month, day] = localDate.split("-").map(Number);
  if (language === "zh") return `${year}年${month}月${day}日`;
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("en-NZ", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}
