"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import type { EventCategory } from "../lib/event-categories";
import { parseEventKeyword } from "../lib/event-search-params";
import type { EventNameSuggestion } from "../lib/event-suggestions";
import type { EventWindow } from "../lib/event-window";

type SuggestionStatus = "idle" | "loading" | "ready" | "unavailable";

type SuggestionState = {
  key: string;
  status: SuggestionStatus;
  items: EventNameSuggestion[];
};

type SuggestionCopy = {
  loading: string;
  empty: string;
  unavailable: string;
};

type EventNameComboboxProps = {
  value: string;
  onChange: (value: string) => void;
  onSelect: (value: string) => void;
  window: EventWindow;
  category: EventCategory | null;
  venueId: string;
  placeholder: string;
  helperId: string;
  language: "en" | "zh";
  copy: SuggestionCopy;
};

function parseSuggestionResponse(value: unknown): EventNameSuggestion[] | null {
  if (typeof value !== "object" || value === null || !("suggestions" in value)) return null;
  if (!Array.isArray(value.suggestions)) return null;
  const suggestions: EventNameSuggestion[] = [];
  for (const item of value.suggestions) {
    if (
      typeof item !== "object" || item === null
      || !("name" in item) || typeof item.name !== "string"
      || !("category" in item) || typeof item.category !== "string"
      || !("localDate" in item) || typeof item.localDate !== "string"
      || !("venueName" in item)
      || (item.venueName !== null && typeof item.venueName !== "string")
    ) return null;
    suggestions.push({
      name: item.name,
      category: item.category,
      localDate: item.localDate,
      venueName: item.venueName,
    });
  }
  return suggestions;
}

function suggestionUrl(
  query: string,
  window: EventWindow,
  category: EventCategory | null,
  venueId: string,
): string {
  const params = new URLSearchParams({ q: query, window });
  if (category) params.set("category", category);
  if (venueId) params.set("venue", venueId);
  return `/api/events/suggestions?${params.toString()}`;
}

function suggestionDate(localDate: string, language: "en" | "zh"): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(localDate);
  if (!parts) return localDate;
  const [year, month, day] = parts.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return localDate;
  return new Intl.DateTimeFormat(language === "zh" ? "zh-NZ" : "en-NZ", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

async function requestSuggestions(url: string, signal: AbortSignal) {
  const response = await fetch(url, { headers: { accept: "application/json" }, signal });
  if (!response.ok) throw new Error("Suggestion request unavailable");
  const parsed = parseSuggestionResponse(await response.json());
  if (!parsed) throw new Error("Suggestion response invalid");
  return parsed;
}

function useSuggestions(
  canSuggest: boolean,
  query: string | null,
  eventWindow: EventWindow,
  category: EventCategory | null,
  venueId: string,
  requestKey: string,
) {
  const [state, setState] = useState<SuggestionState>({ key: "", status: "idle", items: [] });
  useEffect(() => {
    if (!canSuggest || !query) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setState({ key: requestKey, status: "loading", items: [] });
      requestSuggestions(suggestionUrl(query, eventWindow, category, venueId), controller.signal)
        .then((items) => {
          if (!controller.signal.aborted) setState({ key: requestKey, status: "ready", items });
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setState({ key: requestKey, status: "unavailable", items: [] });
          }
        });
    }, 220);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [canSuggest, category, eventWindow, query, requestKey, venueId]);
  return { state, dismiss: () => setState({ key: "", status: "idle", items: [] }) };
}

type InputProps = {
  value: string;
  placeholder: string;
  helperId: string;
  expanded: boolean;
  busy: boolean;
  activeIndex: number;
  hasActiveItem: boolean;
  onFocus: () => void;
  onBlur: () => void;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
};

function ComboboxInput(props: InputProps) {
  return (
    <input
      className="event-search-input"
      id="event-search-name"
      name="q"
      type="search"
      role="combobox"
      value={props.value}
      maxLength={100}
      placeholder={props.placeholder}
      enterKeyHint="search"
      autoComplete="off"
      aria-autocomplete="list"
      aria-expanded={props.expanded}
      aria-controls={props.expanded ? "event-search-suggestions" : undefined}
      aria-activedescendant={props.expanded && props.hasActiveItem
        ? `event-search-suggestion-${props.activeIndex}`
        : undefined}
      aria-describedby={props.helperId}
      aria-busy={props.busy}
      onFocus={props.onFocus}
      onBlur={props.onBlur}
      onChange={(event) => props.onChange(event.target.value)}
      onKeyDown={props.onKeyDown}
    />
  );
}

function statusMessage(state: SuggestionState, copy: SuggestionCopy): string | null {
  if (state.status === "loading") return copy.loading;
  if (state.status === "unavailable") return copy.unavailable;
  if (state.status === "ready" && state.items.length === 0) return copy.empty;
  return null;
}

type SuggestionListProps = {
  items: EventNameSuggestion[];
  activeIndex: number;
  language: "en" | "zh";
  choose: (index: number) => void;
};

function SuggestionList({ items, activeIndex, language, choose }: SuggestionListProps) {
  return (
    <ul id="event-search-suggestions" className="event-suggestion-list" role="listbox">
      {items.map((suggestion, index) => (
        <li
          key={suggestion.name}
          id={`event-search-suggestion-${index}`}
          className="event-suggestion-option"
          role="option"
          aria-selected={index === activeIndex}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => choose(index)}
        >
          <strong>{suggestion.name}</strong>
          <span>
            {suggestionDate(suggestion.localDate, language)}
            {suggestion.venueName ? ` · ${suggestion.venueName}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function revealOption(index: number): void {
  window.requestAnimationFrame(() => {
    document.getElementById(`event-search-suggestion-${index}`)
      ?.scrollIntoView({ block: "nearest" });
  });
}

function handleSuggestionKey(
  event: KeyboardEvent<HTMLInputElement>,
  items: EventNameSuggestion[],
  activeIndex: number,
  setActiveIndex: (index: number) => void,
  choose: (index: number) => void,
) {
  if (items.length === 0) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = (activeIndex + direction + items.length) % items.length;
    setActiveIndex(nextIndex);
    revealOption(nextIndex);
  } else if (event.key === "Enter") {
    event.preventDefault();
    choose(activeIndex);
  }
}

export function EventNameCombobox({
  value,
  onChange,
  onSelect,
  window: eventWindow,
  category,
  venueId,
  placeholder,
  helperId,
  language,
  copy,
}: EventNameComboboxProps) {
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const query = useMemo(() => parseEventKeyword(value), [value]);
  const canSuggest = focused && query !== null && [...query].length >= 2;
  const requestKey = JSON.stringify([query, eventWindow, category, venueId]);
  const { state, dismiss } = useSuggestions(
    canSuggest, query, eventWindow, category, venueId, requestKey,
  );
  const popoverVisible = canSuggest && state.key === requestKey && state.status !== "idle";
  const expanded = popoverVisible && state.status === "ready" && state.items.length > 0;
  const selectedIndex = Math.min(activeIndex, Math.max(0, state.items.length - 1));

  function choose(index: number): void {
    const suggestion = state.items[index];
    if (!suggestion) return;
    setFocused(false);
    dismiss();
    onChange(suggestion.name);
    onSelect(suggestion.name);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (!popoverVisible) return;
    if (event.key === "Escape") {
      event.preventDefault();
      dismiss();
      return;
    }
    if (!expanded) return;
    handleSuggestionKey(event, state.items, selectedIndex, setActiveIndex, choose);
  }

  function changeValue(nextValue: string): void {
    setActiveIndex(0);
    onChange(nextValue);
  }

  const message = statusMessage(state, copy);
  return (
    <div className="event-name-combobox">
      <ComboboxInput
        value={value}
        placeholder={placeholder}
        helperId={helperId}
        expanded={expanded}
        busy={state.status === "loading"}
        activeIndex={selectedIndex}
        hasActiveItem={Boolean(state.items[selectedIndex])}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={changeValue}
        onKeyDown={handleKeyDown}
      />
      {popoverVisible && (
        <div className="event-suggestion-popover">
          {message && <p className="event-suggestion-status" role="status">{message}</p>}
          {state.status === "ready" && state.items.length > 0 && (
            <SuggestionList
              items={state.items}
              activeIndex={selectedIndex}
              language={language}
              choose={choose}
            />
          )}
        </div>
      )}
    </div>
  );
}
