const EVENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export function parseEventId(value: unknown): string | null {
  return typeof value === "string" && EVENT_ID_PATTERN.test(value)
    ? value
    : null;
}
