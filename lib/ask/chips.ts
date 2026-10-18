import type { AskChip, AskFilters } from "./schema";

type Language = "en" | "zh";
const labels = {
  en: {
    domain: { events: "Events", movies: "Movies", markets: "Markets" },
    timeOfDay: { day: "Daytime", morning: "Morning", afternoon: "Afternoon", evening: "Evening" },
    area: { north: "North", central: "Central", east: "East", south: "South", west: "West" },
    category: { music: "Music", theatre: "Arts & theatre", family: "Family", sports: "Sports", other: "Tours & more" },
    kids: "With kids", free: "Free", maxPrice: (price: number) => `≤ $${price}`,
  },
  zh: {
    domain: { events: "活动", movies: "电影", markets: "市集" },
    timeOfDay: { day: "白天", morning: "上午", afternoon: "下午", evening: "晚上" },
    area: { north: "北区", central: "市中心", east: "东区", south: "南区", west: "西区" },
    category: { music: "音乐", theatre: "戏剧艺术", family: "亲子家庭", sports: "体育", other: "导览及其他" },
    kids: "亲子", free: "免费", maxPrice: (price: number) => `${price} 元以内`,
  },
} as const;

function formatDate(date: string, language: Language): string {
  const noon = new Date(`${date}T12:00:00Z`);
  if (language === "zh") {
    // ICU renders zh numeric dates as "10/3", so compose the conventional 10月3日周六 directly.
    const weekday = new Intl.DateTimeFormat("zh-CN", { timeZone: "UTC", weekday: "short" }).format(noon);
    return `${noon.getUTCMonth() + 1}月${noon.getUTCDate()}日${weekday}`;
  }
  return new Intl.DateTimeFormat("en-NZ", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" })
    .format(noon).replace(/,/gu, "");
}

function dateLabel(dates: readonly string[], language: Language): string {
  const first = formatDate(dates[0], language);
  return dates.length === 1 ? first : `${first} – ${formatDate(dates[dates.length - 1], language)}`;
}

export function chipsFor(filters: AskFilters, language: Language): AskChip[] {
  const text = labels[language];
  const chips: AskChip[] = [];
  if (filters.domain !== "any") chips.push({ key: "domain", label: text.domain[filters.domain] });
  if (filters.dates.length > 0) chips.push({ key: "dates", label: dateLabel(filters.dates, language) });
  if (filters.timeOfDay !== "any") chips.push({ key: "timeOfDay", label: text.timeOfDay[filters.timeOfDay] });
  if (filters.area !== "any") chips.push({ key: "area", label: text.area[filters.area] });
  if (filters.category !== "any") chips.push({ key: "category", label: text.category[filters.category] });
  if (filters.kids) chips.push({ key: "kids", label: text.kids });
  if (filters.free) chips.push({ key: "free", label: text.free });
  if (filters.maxPrice !== null) chips.push({ key: "maxPrice", label: text.maxPrice(filters.maxPrice) });
  if (filters.totalBudget !== null) chips.push({ key: "totalBudget", label: language === "zh" ? `总预算 $${filters.totalBudget}` : `Total budget $${filters.totalBudget}` });
  if (filters.partySize > 1) chips.push({ key: "partySize", label: language === "zh" ? `${filters.partySize} 人` : `${filters.partySize} people` });
  const clock = (minute: number) => `${Math.floor(minute / 60).toString().padStart(2, "0")}:${(minute % 60).toString().padStart(2, "0")}`;
  if (filters.startMinute !== null) chips.push({ key: "startMinute", label: `${language === "zh" ? "开始不早于" : "Starts from"} ${clock(filters.startMinute)}` });
  if (filters.endMinute !== null) chips.push({ key: "endMinute", label: `${language === "zh" ? "开始早于" : "Starts before"} ${clock(filters.endMinute)}` });
  if (filters.place) chips.push({ key: "place", label: filters.place });
  filters.names.forEach((name, index) => chips.push({ key: `name:${index}`, label: name }));
  return chips;
}

export function clearChip(filters: AskFilters, key: string): AskFilters {
  if (key.startsWith("name:")) return { ...filters, names: filters.names.filter((_, index) => `name:${index}` !== key) };
  switch (key) {
    case "domain": return { ...filters, domain: "any" };
    case "dates": return { ...filters, dates: [] };
    case "timeOfDay": return { ...filters, timeOfDay: "any", startMinute: null, endMinute: null };
    case "area": return { ...filters, area: "any" };
    case "category": return { ...filters, category: "any" };
    case "kids": return { ...filters, kids: false };
    case "free": return { ...filters, free: false };
    case "place": return { ...filters, place: null };
    case "maxPrice": return { ...filters, maxPrice: null };
    case "totalBudget": return { ...filters, totalBudget: null };
    case "partySize": return { ...filters, partySize: 1 };
    case "startMinute": return { ...filters, startMinute: null };
    case "endMinute": return { ...filters, endMinute: null };
    default: return filters;
  }
}

/** What the assistant can drop when the visitor agrees to widen a search. */
export const LOOSEN_KEYS = ["domain", "dates", "timeOfDay", "area", "category", "kids", "free", "budget", "place", "names"] as const;
export type LoosenKey = (typeof LOOSEN_KEYS)[number];

function loosens(key: LoosenKey, chipKey: string): boolean {
  if (key === "budget") return chipKey === "maxPrice" || chipKey === "totalBudget";
  if (key === "names") return chipKey.startsWith("name:");
  if (key === "timeOfDay") return chipKey === "timeOfDay" || chipKey === "startMinute" || chipKey === "endMinute";
  return chipKey === key;
}

/** Drops the named conditions and returns the chips that went, so the visitor can be told what changed. */
export function loosenFilters(filters: AskFilters, keys: readonly LoosenKey[], language: Language): { filters: AskFilters; dropped: AskChip[] } {
  const dropped = chipsFor(filters, language).filter((chip) => keys.some((key) => loosens(key, chip.key)));
  const cleared = dropped.reduce((current, chip) => chip.key.startsWith("name:") ? current : clearChip(current, chip.key), filters);
  return { filters: keys.includes("names") ? { ...cleared, names: [] } : cleared, dropped };
}
