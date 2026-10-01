"use client";

import Link from "next/link";
import { useState } from "react";
import { AskCards } from "./ask-cards";
import type { AskViewState } from "./use-ask-stream";

type Language = "en" | "zh";
const copy = {
  en: {
    thinking: "Finding the best options…",
    remove: (label: string) => `Remove ${label}`, signIn: "Sign in",
    loosened: (label: string) => `${label} (loosened)`, closest: "No exact match — here are the closest.",
    tmdb: "Movie pictures and trailers via TMDB.", looking: "Looking at", edit: "Edit", doneEditing: "Done",
  },
  zh: {
    thinking: "正在找最合适的…",
    remove: (label: string) => `移除 ${label}`, signIn: "登录",
    loosened: (label: string) => `${label}（已放宽）`, closest: "没有完全符合的，以下是最接近的。",
    tmdb: "电影图片和预告片来自 TMDB。", looking: "正在看", edit: "修改", doneEditing: "完成",
  },
} as const;

export function AskError({ error, language }: { error: NonNullable<AskViewState["error"]>; language: Language }) {
  return (
    <div className="ask-error" role="alert">
      <p>{error.message}</p>
      {error.code === "quota_exhausted" ? <Link href="/login">{copy[language].signIn}</Link> : null}
    </div>
  );
}

function AskChips({ state, language, onRemove }: { state: AskViewState; language: Language; onRemove?(key: string): void }) {
  if (state.chips.length === 0) return null;
  return <ul className="ask-chips">{state.chips.map((chip) => (
    <li key={chip.key}>
      {state.relaxed.includes(chip.key)
        ? <span data-relaxed=""><span aria-hidden="true">{chip.label}</span><span className="ask-sr">{copy[language].loosened(chip.label)}</span></span>
        : onRemove
        ? <button type="button" aria-label={copy[language].remove(chip.label)} onClick={() => onRemove(chip.key)}>{chip.label}<span aria-hidden="true"> ×</span></button>
        : <span>{chip.label}</span>}
    </li>
  ))}</ul>;
}

/** One quiet line of what the search covers; Edit reveals the removable chips. */
function FilterLine({ state, language, onRemove }: { state: AskViewState; language: Language; onRemove?(key: string): void }) {
  const [editing, setEditing] = useState(false);
  const content = copy[language];
  if (state.chips.length === 0) return null;
  if (editing && onRemove) {
    return (
      <div className="ask-filter-edit">
        <AskChips state={state} language={language} onRemove={onRemove} />
        <button type="button" className="ask-filter-toggle" onClick={() => setEditing(false)}>{content.doneEditing}</button>
      </div>
    );
  }
  return (
    <p className="ask-filter-line">
      <span>{content.looking}: </span>
      {state.chips.map((chip, index) => (
        <span key={chip.key} data-relaxed={state.relaxed.includes(chip.key) || undefined}>
          {index > 0 ? " · " : null}{chip.label}{state.relaxed.includes(chip.key) ? <span className="ask-sr"> {content.loosened(chip.label)}</span> : null}
        </span>
      ))}
      {onRemove ? <button type="button" className="ask-filter-toggle" onClick={() => setEditing(true)}>{content.edit}</button> : null}
    </p>
  );
}

type AskResultsProps = { state: AskViewState; language: Language; onRemoveChip?(key: string): void; onSound?(): void };

/** What a search found: a line of what it covers, any notices, and the cards in the chosen layout. */
export function AskResults({ state, language, onRemoveChip, onSound }: AskResultsProps) {
  if (state.error) return <AskError error={state.error} language={language} />;
  const content = copy[language];
  // Cards are on their way: a search started (its chips arrived) but nothing is listed yet.
  const searching = state.status === "streaming" && state.chips.length > 0 && state.cards.length === 0 && !state.reply;
  return (
    <div className="ask-results">
      <FilterLine state={state} language={language} onRemove={onRemoveChip} />
      {state.notices.map((notice) => <p key={notice} className="ask-notice" role="status">{notice}</p>)}
      {searching ? <div className="ask-skeleton" role="status" aria-label={content.thinking}><span /><span /><span /></div> : null}
      {state.relaxed.length > 0 && state.cards.length > 0 ? <p className="ask-closest">{content.closest}</p> : null}
      <AskCards cards={state.cards} bestId={state.bestId} layout={state.layout} language={language} onSound={onSound} />
      {state.cards.some((card) => card.kind === "movie" && (card.trailerKey || card.imageUrl)) ? <p className="ask-credit">{content.tmdb}</p> : null}
    </div>
  );
}
