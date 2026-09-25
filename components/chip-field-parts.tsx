"use client";

import { useLayoutEffect, useRef } from "react";
import type { ActiveChip, ChipOption } from "../lib/chip-field";
import { animateExit } from "./chip-field-motion";

type NodeRef = (node: HTMLElement | null) => void;

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true" focusable="false">
      <path d="M3 3l6 6M9 3l-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false">
      <path d="M3 5.5h14M5.5 10h9M8 14.5h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function FilterChip({ option, selected, motionRef, onToggle }: {
  option: ChipOption;
  selected: boolean;
  motionRef: NodeRef;
  onToggle: (option: ChipOption) => void;
}) {
  return (
    <button
      ref={motionRef}
      type="button"
      className="chipfield-chip"
      data-selected={selected || undefined}
      aria-pressed={selected}
      onClick={() => onToggle(option)}
    >
      <span className="chipfield-chip__press">
        <span className="chipfield-chip__surface" data-motion-surface aria-hidden="true" />
        <span className="chipfield-chip__check" aria-hidden="true"><CheckIcon /></span>
        <span className="chipfield-chip__label" data-motion-label>{option.label}</span>
      </span>
    </button>
  );
}

export function TagChip({ chip, leaving, motionRef, removeLabel, onRemove, onExited }: {
  chip: ActiveChip;
  leaving: boolean;
  motionRef: NodeRef;
  removeLabel: string;
  onRemove: (key: string) => void;
  onExited: (key: string) => void;
}) {
  const node = useRef<HTMLLIElement | null>(null);
  const onExitedRef = useRef(onExited);
  useLayoutEffect(() => { onExitedRef.current = onExited; });
  useLayoutEffect(() => {
    if (!leaving || !node.current) return;
    return animateExit(node.current, () => onExitedRef.current(chip.key));
  }, [leaving, chip.key]);

  return (
    <li
      ref={(element) => { node.current = element; motionRef(element); }}
      className="chipfield-tag"
      data-kind={chip.kind}
      data-leaving={leaving || undefined}
      aria-hidden={leaving || undefined}
      inert={leaving}
    >
      <span className="chipfield-chip__press">
        <span className="chipfield-chip__surface" data-motion-surface aria-hidden="true" />
        <span className="chipfield-tag__label">{chip.label}</span>
        <button type="button" className="chipfield-tag__remove" aria-label={removeLabel} onClick={() => onRemove(chip.key)}>
          <CloseIcon />
        </button>
      </span>
    </li>
  );
}

export function FilterButton({ count, expanded, controls, label, onToggle }: {
  count: number;
  expanded: boolean;
  controls: string;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="chipfield-filter-button"
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onToggle}
    >
      <FilterIcon />
      <span>{label}</span>
      <span className="chipfield-badge" data-empty={count === 0 || undefined}>
        {/* Re-keying remounts the digit so its pop animation replays on every change. */}
        <span key={count} className="chipfield-badge__value">{count}</span>
      </span>
    </button>
  );
}
