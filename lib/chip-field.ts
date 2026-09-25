export type ChipOption = { id: string; label: string };

/** One active filter: either a preset option or a user-created tag, kept in insertion order. */
export type ActiveChip = { key: string; label: string; kind: "filter" | "custom" };

export type AddTagResult =
  | { status: "added"; chip: ActiveChip }
  | { status: "selected"; chip: ActiveChip }
  | { status: "duplicate"; key: string }
  | { status: "empty" }
  | { status: "limit" };

export const TAG_MAX_LENGTH = 32;
export const CUSTOM_TAG_LIMIT = 12;

// Control, zero-width and bidi-override characters can make two tags look identical
// or reorder surrounding UI text, so they never reach a label.
const INVISIBLE_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g;

export function normalizeTagLabel(raw: string, maxLength = TAG_MAX_LENGTH): string {
  const collapsed = raw.replace(INVISIBLE_CHARS, "").replace(/\s+/g, " ").trim();
  // Slice by code point so emoji and CJK surrogate pairs are never split in half.
  return Array.from(collapsed).slice(0, maxLength).join("").trim();
}

const fold = (label: string) => label.normalize("NFKC").toLocaleLowerCase();

export const filterKey = (id: string) => `filter:${id}`;
export const customKey = (label: string) => `custom:${fold(label)}`;

export function isActive(active: readonly ActiveChip[], key: string): boolean {
  return active.some((chip) => chip.key === key);
}

export function toggleFilter(active: readonly ActiveChip[], option: ChipOption): ActiveChip[] {
  const key = filterKey(option.id);
  if (isActive(active, key)) return active.filter((chip) => chip.key !== key);
  return [...active, { key, label: option.label, kind: "filter" }];
}

export function removeChip(active: readonly ActiveChip[], key: string): ActiveChip[] {
  return active.filter((chip) => chip.key !== key);
}

/**
 * Typing the name of a preset selects that preset instead of creating a look-alike
 * custom tag, so the same filter can never be active twice under two keys.
 */
export function addTag(
  active: readonly ActiveChip[],
  raw: string,
  options: readonly ChipOption[],
  customLimit = CUSTOM_TAG_LIMIT,
): { active: readonly ActiveChip[]; result: AddTagResult } {
  const label = normalizeTagLabel(raw);
  if (!label) return { active, result: { status: "empty" } };
  const option = options.find((candidate) => fold(candidate.label) === fold(label));
  const key = option ? filterKey(option.id) : customKey(label);
  if (isActive(active, key)) return { active, result: { status: "duplicate", key } };
  const customCount = active.filter((chip) => chip.kind === "custom").length;
  if (!option && customCount >= customLimit) return { active, result: { status: "limit" } };
  const chip: ActiveChip = option
    ? { key, label: option.label, kind: "filter" }
    : { key, label, kind: "custom" };
  return { active: [...active, chip], result: { status: option ? "selected" : "added", chip } };
}
