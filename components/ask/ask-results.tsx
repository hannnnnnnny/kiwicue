"use client";

import Link from "next/link";
import { AskResultCard } from "./ask-result-card";
import type { AskViewState } from "./use-ask-stream";

type Language = "en" | "zh";
const copy = {
  en: {
    thinking: "Finding the best options…", empty: "Nothing matched. Try removing a filter or asking more broadly.",
    remove: (label: string) => `Remove ${label}`, signIn: "Sign in",
    loosened: (label: string) => `${label} (loosened)`, closest: "No exact match — here are the closest.",
  },
  zh: {
    thinking: "正在找最合适的…", empty: "没有找到匹配的结果，试试去掉一个条件或换个问法。",
    remove: (label: string) => `移除 ${label}`, signIn: "登录",
    loosened: (label: string) => `${label}（已放宽）`, closest: "没有完全符合的，以下是最接近的。",
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

/** One search answer: chips, the one-sentence reply, the best match and the other cards. */
export function AskResults({ state, language, onRemoveChip }: { state: AskViewState; language: Language; onRemoveChip?(key: string): void }) {
  if (state.error) return <AskError error={state.error} language={language} />;
  const content = copy[language];
  const best = state.cards.find((card) => card.id === state.bestId) ?? null;
  const others = state.cards.filter((card) => card !== best);
  return (
    <div className="ask-results">
      <AskChips state={state} language={language} onRemove={onRemoveChip} />
      {state.relaxed.length > 0 && state.cards.length > 0 ? <p className="ask-closest">{content.closest}</p> : null}
      {state.reply ? <p className="ask-reply">{state.reply}</p> : null}
      {state.notices.map((notice) => <p key={notice} className="ask-notice" role="status">{notice}</p>)}
      {state.status === "thinking" ? <div className="ask-skeleton" role="status" aria-label={content.thinking}><span /><span /><span /></div> : null}
      {best ? <AskResultCard card={best} best language={language} /> : null}
      {others.length > 0 ? <ol className="ask-list">{others.map((card, index) => (
        <li key={card.id} style={{ animationDelay: `${Math.min(index, 12) * 80}ms` }}><AskResultCard card={card} best={false} language={language} /></li>
      ))}</ol> : null}
      {state.status === "done" && state.cards.length === 0 ? <p className="ask-empty">{content.empty}</p> : null}
    </div>
  );
}
