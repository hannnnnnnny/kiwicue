import type {
  EventEditorialImage,
  EventEditorialPreview,
  EventLocalization,
  EventSource,
  KiwiCueEvent,
  KiwiCueVenue,
} from "./events";

export const BOOKMARK_STORAGE_KEY = "kiwicue:bookmarks:v1";
export const MAX_BOOKMARKS = 100;
const MAX_STORAGE_LENGTH = 1_000_000;
const MAX_CANDIDATES = 500;

export type EventBookmark = {
  event: KiwiCueEvent;
  savedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, maximum: number, allowEmpty = false): value is string {
  return typeof value === "string" && value.length <= maximum && (allowEmpty || value.trim().length > 0);
}

function nullableBoundedString(value: unknown, maximum: number): value is string | null {
  return value === null || boundedString(value, maximum);
}

function safeHttpsUrl(value: unknown): value is string {
  if (!boundedString(value, 2_048)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function validLocalDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validLocalTime(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value));
}

function validIsoDate(value: unknown): value is string {
  return typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));
}

function validOptionalIsoDate(value: unknown): value is string | null {
  return value === null || validIsoDate(value);
}

function parseVenue(value: unknown): KiwiCueVenue | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  if (
    !boundedString(value.id, 128)
    || !boundedString(value.name, 300)
    || !boundedString(value.city, 120)
    || !nullableBoundedString(value.address, 500)
    || !nullableBoundedString(value.postalCode, 40)
  ) return undefined;

  let coordinates: KiwiCueVenue["coordinates"];
  if (value.coordinates === null) {
    coordinates = null;
  } else if (
    isRecord(value.coordinates)
    && typeof value.coordinates.latitude === "number"
    && Number.isFinite(value.coordinates.latitude)
    && value.coordinates.latitude >= -90
    && value.coordinates.latitude <= 90
    && typeof value.coordinates.longitude === "number"
    && Number.isFinite(value.coordinates.longitude)
    && value.coordinates.longitude >= -180
    && value.coordinates.longitude <= 180
  ) {
    coordinates = {
      latitude: value.coordinates.latitude,
      longitude: value.coordinates.longitude,
    };
  } else {
    return undefined;
  }

  return {
    id: value.id,
    name: value.name,
    city: value.city,
    address: value.address,
    postalCode: value.postalCode,
    coordinates,
  };
}

function parseSource(value: unknown): EventSource | undefined {
  if (!isRecord(value)) return undefined;
  if (
    !boundedString(value.name, 300)
    || !safeHttpsUrl(value.url)
    || !validLocalDate(value.verifiedAt)
  ) return undefined;
  return { name: value.name, url: value.url, verifiedAt: value.verifiedAt };
}

function parseHighlights(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) return undefined;
  if (!value.every((item) => boundedString(item, 300))) return undefined;
  return [...value];
}

function parseEditorialImage(value: unknown): EventEditorialImage | undefined {
  if (!isRecord(value)) return undefined;
  if (
    !safeHttpsUrl(value.url)
    || !boundedString(value.alt, 500)
    || !boundedString(value.sourceName, 500)
    || !safeHttpsUrl(value.sourceUrl)
    || !validLocalDate(value.verifiedAt)
  ) return undefined;
  return {
    url: value.url,
    alt: value.alt,
    sourceName: value.sourceName,
    sourceUrl: value.sourceUrl,
    verifiedAt: value.verifiedAt,
  };
}

function parseEditorialPreview(value: unknown): EventEditorialPreview | undefined {
  if (!isRecord(value) || !boundedString(value.summary, 800)) return undefined;
  const highlights = parseHighlights(value.highlights);
  if (!highlights) return undefined;
  const image = parseEditorialImage(value.image);
  return {
    summary: value.summary,
    highlights,
    ...(image ? { image } : {}),
  };
}

function parseLocalization(value: unknown): EventLocalization | undefined {
  if (!isRecord(value) || !isRecord(value.zh)) return undefined;
  const {
    name,
    description,
    note,
    previewSummary,
    previewHighlights,
    previewImageAlt,
  } = value.zh;
  if (
    (name !== undefined && !boundedString(name, 300))
    || (description !== undefined && !boundedString(description, 4_000))
    || (note !== undefined && !boundedString(note, 2_000))
  ) return undefined;
  const safePreviewSummary = boundedString(previewSummary, 800)
    ? previewSummary
    : undefined;
  const safePreviewHighlights = parseHighlights(previewHighlights);
  const safePreviewImageAlt = boundedString(previewImageAlt, 500)
    ? previewImageAlt
    : undefined;
  if (
    name === undefined
    && description === undefined
    && note === undefined
    && !safePreviewSummary
    && !safePreviewHighlights
    && !safePreviewImageAlt
  ) return undefined;
  return {
    zh: {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(safePreviewSummary ? { previewSummary: safePreviewSummary } : {}),
      ...(safePreviewHighlights ? { previewHighlights: safePreviewHighlights } : {}),
      ...(safePreviewImageAlt ? { previewImageAlt: safePreviewImageAlt } : {}),
    },
  };
}

function parseEvent(value: unknown): KiwiCueEvent | null {
  if (!isRecord(value) || !isRecord(value.start)) return null;
  const venue = parseVenue(value.venue);
  const source = parseSource(value.source);
  const localization = parseLocalization(value.localization);
  const editorialPreview = parseEditorialPreview(value.editorialPreview);
  if (
    !boundedString(value.id, 128)
    || !/^[A-Za-z0-9_-]+$/.test(value.id)
    || !boundedString(value.name, 300)
    || !safeHttpsUrl(value.url)
    || !(value.imageUrl === null || safeHttpsUrl(value.imageUrl))
    || !validLocalDate(value.start.localDate)
    || !validLocalTime(value.start.localTime)
    || !validOptionalIsoDate(value.start.dateTime)
    || !boundedString(value.start.timezone, 100)
    || !boundedString(value.status, 80)
    || !boundedString(value.category, 120)
    || venue === undefined
  ) return null;

  return {
    id: value.id,
    name: value.name,
    url: value.url,
    imageUrl: value.imageUrl,
    start: {
      localDate: value.start.localDate,
      localTime: value.start.localTime,
      dateTime: value.start.dateTime,
      timezone: value.start.timezone,
    },
    status: value.status,
    category: value.category,
    venue,
    ...(source ? { source } : {}),
    ...(localization ? { localization } : {}),
    ...(editorialPreview ? { editorialPreview } : {}),
  };
}

function parseBookmark(value: unknown): EventBookmark | null {
  if (!isRecord(value) || !validIsoDate(value.savedAt)) return null;
  const event = parseEvent(value.event);
  return event ? { event, savedAt: value.savedAt } : null;
}

function newestUnique(items: EventBookmark[]): EventBookmark[] {
  const newest = [...items].sort((left, right) => Date.parse(right.savedAt) - Date.parse(left.savedAt));
  const seen = new Set<string>();
  return newest.filter((bookmark) => {
    if (seen.has(bookmark.event.id)) return false;
    seen.add(bookmark.event.id);
    return true;
  }).slice(0, MAX_BOOKMARKS);
}

export function parseBookmarks(serialized: string | null): EventBookmark[] {
  if (!serialized || serialized.length > MAX_STORAGE_LENGTH) return [];
  try {
    const payload: unknown = JSON.parse(serialized);
    if (!isRecord(payload) || payload.version !== 1 || !Array.isArray(payload.items)) return [];
    const bookmarks = payload.items
      .slice(0, MAX_CANDIDATES)
      .map(parseBookmark)
      .filter((bookmark): bookmark is EventBookmark => bookmark !== null);
    return newestUnique(bookmarks);
  } catch {
    return [];
  }
}

export function toBookmark(event: KiwiCueEvent, savedAt = new Date().toISOString()): EventBookmark {
  const bookmark = parseBookmark({ event, savedAt });
  if (!bookmark) throw new RangeError("Invalid bookmark");
  return bookmark;
}

export function serializeBookmarks(bookmarks: EventBookmark[]): string {
  const validated = bookmarks.map((bookmark) => {
    const parsed = parseBookmark(bookmark);
    if (!parsed) throw new RangeError("Invalid bookmark");
    return parsed;
  });
  return JSON.stringify({ version: 1, items: newestUnique(validated) });
}

export function toggleBookmarkItem(
  bookmarks: EventBookmark[],
  event: KiwiCueEvent,
  savedAt = new Date().toISOString(),
): EventBookmark[] {
  const existing = bookmarks.find((bookmark) => bookmark.event.id === event.id);
  if (existing) return bookmarks.filter((bookmark) => bookmark.event.id !== event.id);
  return newestUnique([toBookmark(event, savedAt), ...bookmarks]);
}
