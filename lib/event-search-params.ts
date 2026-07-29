const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/u;
const VENUE_ID = /^[A-Za-z0-9_-]{1,80}$/u;

type PublicValue = string | string[] | null | undefined;

export type EventSearchFilters = {
  keyword: string | null;
  venueId: string | null;
};

export function parseEventKeyword(value: PublicValue): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (
    !normalized ||
    [...normalized].length > 100 ||
    CONTROL_CHARACTERS.test(normalized)
  ) return null;
  return normalized;
}

export function parseVenueId(value: PublicValue): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return VENUE_ID.test(normalized) ? normalized : null;
}
