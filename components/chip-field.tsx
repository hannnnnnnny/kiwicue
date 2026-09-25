"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from "react";
import {
  addTag, CUSTOM_TAG_LIMIT, filterKey, isActive, removeChip, TAG_MAX_LENGTH, toggleFilter,
  type ActiveChip, type AddTagResult, type ChipOption,
} from "../lib/chip-field";
import { FilterButton, FilterChip, TagChip } from "./chip-field-parts";
import { useLayoutMotion, usePresence } from "./chip-field-motion";

export type ChipFieldCopy = {
  filters: string;
  active: string;
  placeholder: string;
  hint: string;
  remove: (label: string) => string;
  added: (label: string) => string;
  removed: (label: string) => string;
  duplicate: (label: string) => string;
  limit: (max: number) => string;
};

const DEFAULT_COPY: ChipFieldCopy = {
  filters: "Filters",
  active: "Active",
  placeholder: "Add a tag",
  hint: "Enter adds a tag · Backspace removes the last one",
  remove: (label) => `Remove ${label}`,
  added: (label) => `Added ${label}`,
  removed: (label) => `Removed ${label}`,
  duplicate: (label) => `${label} is already active`,
  limit: (max) => `You can add up to ${max} custom tags`,
};

export type ChipFieldProps = {
  title: string;
  options: readonly ChipOption[];
  value: readonly ActiveChip[];
  onChange: (next: readonly ActiveChip[]) => void;
  /** When false, selected presets stay in the option row and only custom tags become removable chips. */
  showSelectedAsTags?: boolean;
  customTagLimit?: number;
  copy?: Partial<ChipFieldCopy>;
};

type Notice = { tone: "info" | "warn"; text: string };

function describeAdd(result: AddTagResult, value: readonly ActiveChip[], copy: ChipFieldCopy, limit: number): Notice | null {
  switch (result.status) {
    case "added":
    case "selected":
      return { tone: "info", text: copy.added(result.chip.label) };
    case "duplicate":
      return { tone: "warn", text: copy.duplicate(value.find((chip) => chip.key === result.key)?.label ?? "") };
    case "limit":
      return { tone: "warn", text: copy.limit(limit) };
    case "empty":
      return null;
  }
}

function useChipField(props: ChipFieldProps, copy: ChipFieldCopy) {
  const { options, value, onChange, customTagLimit = CUSTOM_TAG_LIMIT } = props;
  const motion = useLayoutMotion();
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const commit = (next: readonly ActiveChip[]) => { motion.capture(); onChange(next); };

  const remove = (key: string) => {
    const chip = value.find((candidate) => candidate.key === key);
    if (!chip) return;
    commit(removeChip(value, key));
    setNotice({ tone: "info", text: copy.removed(chip.label) });
  };
  const toggle = (option: ChipOption) => {
    const selecting = !isActive(value, filterKey(option.id));
    commit(toggleFilter(value, option));
    setNotice({ tone: "info", text: (selecting ? copy.added : copy.removed)(option.label) });
  };
  const submit = () => {
    const { active, result } = addTag(value, draft, options, customTagLimit);
    setNotice(describeAdd(result, value, copy, customTagLimit));
    if (result.status === "duplicate") motion.nudge(result.key);
    if (result.status === "added" || result.status === "selected") { commit(active); setDraft(""); }
  };
  return { motion, draft, setDraft, notice, setNotice, remove, toggle, submit };
}

type Field = ReturnType<typeof useChipField>;

function useTagKeys(field: Field, tags: readonly ActiveChip[], inputRef: RefObject<HTMLInputElement | null>) {
  return (event: KeyboardEvent<HTMLInputElement>) => {
    // IME composition (Chinese/Japanese input) uses Enter to confirm a candidate, not to submit.
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter") { event.preventDefault(); field.submit(); return; }
    if (event.key === "Backspace" && field.draft === "" && tags.length > 0) {
      event.preventDefault();
      field.remove(tags[tags.length - 1].key);
      return;
    }
    if (event.key === "Escape") {
      if (field.draft) field.setDraft("");
      else inputRef.current?.blur();
      field.setNotice(null);
    }
  };
}

function TagField({ field, tags, copy, labelId }: {
  field: Field;
  tags: readonly ActiveChip[];
  copy: ChipFieldCopy;
  labelId: string;
}) {
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const { entries, release } = usePresence(tags);
  const onKeyDown = useTagKeys(field, tags, inputRef);
  const onExited = (key: string) => { field.motion.capture(); release(key); };
  const removeFromChip = (key: string) => { field.remove(key); inputRef.current?.focus(); };
  const notice = field.notice ?? { tone: "info" as const, text: copy.hint };
  const draftWidth = `${Math.max(9, Array.from(field.draft).length + 2)}ch`;
  const focusFromBackground = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    event.preventDefault();
    inputRef.current?.focus();
  };

  return (
    <>
      <div ref={field.motion.container("tags")} className="chipfield__field" onPointerDown={focusFromBackground}>
        <ul className="chipfield__tags">
          {entries.map(({ key, item, leaving }) => (
            <TagChip key={key} chip={item} leaving={leaving} motionRef={field.motion.item(key)}
              removeLabel={copy.remove(item.label)} onRemove={removeFromChip} onExited={onExited} />
          ))}
          <li ref={field.motion.item("__input")} className="chipfield__input-wrap" style={{ ["--draft-ch" as string]: draftWidth }}>
            <input ref={inputRef} id={labelId} className="chipfield__input" value={field.draft}
              maxLength={TAG_MAX_LENGTH * 2} placeholder={copy.placeholder} enterKeyHint="enter"
              autoComplete="off" spellCheck={false} aria-describedby={hintId}
              aria-invalid={field.notice?.tone === "warn" || undefined}
              onChange={(event) => { field.setDraft(event.target.value); if (field.notice?.tone === "warn") field.setNotice(null); }}
              onKeyDown={onKeyDown} />
          </li>
        </ul>
      </div>
      <p id={hintId} className="chipfield__hint" data-tone={notice.tone} aria-live="polite">{notice.text}</p>
    </>
  );
}

export function ChipField(props: ChipFieldProps) {
  const { title, options, value, showSelectedAsTags = true } = props;
  const copy = useMemo(() => ({ ...DEFAULT_COPY, ...props.copy }), [props.copy]);
  const ids = { title: useId(), body: useId(), input: useId() };
  const [open, setOpen] = useState(true);
  const field = useChipField(props, copy);
  const tags = useMemo(() => value.filter((chip) => showSelectedAsTags || chip.kind === "custom"), [value, showSelectedAsTags]);

  return (
    <section className="chipfield" aria-labelledby={ids.title}>
      <header className="chipfield__header">
        <h2 id={ids.title} className="chipfield__title">{title}</h2>
        <FilterButton count={value.length} expanded={open} controls={ids.body} label={copy.filters} onToggle={() => setOpen((next) => !next)} />
      </header>
      <div id={ids.body} className="chipfield__body" data-open={open || undefined} inert={!open}>
        <div className="chipfield__body-inner">
          <div ref={field.motion.container("options")} className="chipfield__options" role="group" aria-label={copy.filters}>
            {options.map((option) => (
              <FilterChip key={option.id} option={option} selected={isActive(value, filterKey(option.id))}
                motionRef={field.motion.item(`option:${option.id}`)} onToggle={field.toggle} />
            ))}
          </div>
          <label htmlFor={ids.input} className="chipfield__label">{copy.active}</label>
          <TagField field={field} tags={tags} copy={copy} labelId={ids.input} />
        </div>
      </div>
    </section>
  );
}
