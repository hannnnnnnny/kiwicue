import type { AskFilters } from "./schema";

function clock(hourText: string, minuteText: string | undefined, period: string | undefined): number | null {
  let hour = Number(hourText);
  const minute = Number(minuteText ?? 0);
  if (minute > 59 || hour > 23) return null;
  if (period && hour > 12) return null;
  if (period === "pm" && hour < 12) hour += 12;
  if (period === "am" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

export function timeIntent(text: string): Partial<AskFilters> {
  if (/any time|no time restriction|任何时间|不限时间/iu.test(text)) return { timeOfDay: "any", startMinute: null, endMinute: null };
  const result: Partial<AskFilters> = {};
  if (/\bafternoon\b|下午/u.test(text.toLowerCase())) result.timeOfDay = "afternoon";
  else if (/\bmorning\b|上午|早上/u.test(text.toLowerCase())) result.timeOfDay = "morning";
  else if (/\bevening\b|\btonight\b|晚上|今晚/u.test(text.toLowerCase())) result.timeOfDay = "evening";
  if (result.timeOfDay) { result.startMinute = null; result.endMinute = null; }
  const english = [...text.matchAll(/\b(after|from|before|until)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/giu)];
  for (const match of english) {
    const value = clock(match[2], match[3], match[4]?.toLowerCase());
    if (value !== null) setBoundary(result, value, /before|until/iu.test(match[1]));
  }
  const chinese = [...text.matchAll(/(?:(上午|早上|下午|晚上))?\s*(\d{1,2})(?:[:点時时](\d{1,2}))?\s*(?:点|時|时)?\s*(之后|以后|后|之前|以前|前)/gu)];
  for (const match of chinese) {
    const period = /下午|晚上/u.test(match[1] ?? "") ? "pm" : /上午|早上/u.test(match[1] ?? "") ? "am" : undefined;
    const value = clock(match[2], match[3], period);
    if (value !== null) setBoundary(result, value, /之前|以前|前/u.test(match[4]));
  }
  return result;
}

function setBoundary(result: Partial<AskFilters>, value: number, before: boolean): void {
  if (before) result.endMinute = value > 0 ? value : 1440;
  else result.startMinute = value;
}
