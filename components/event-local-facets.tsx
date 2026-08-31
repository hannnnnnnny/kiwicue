"use client";

import type { EventFacetOption, EventLocalFacet } from "../lib/event-facets";
import { useLanguage } from "./language-provider";

const copy = {
  en: {
    eyebrow: "Loaded-result refinements",
    title: "Narrow what is already here",
    body: "These refinements only search the loaded results; they do not change the official feed or its pagination.",
    reset: "Reset refinement",
    group: "Refine loaded results",
  },
  zh: {
    eyebrow: "已加载结果细筛",
    title: "只缩小当前结果",
    body: "这些选项只筛选已经加载的活动，不会改变官方来源或分页范围。",
    reset: "重置细筛",
    group: "筛选已加载结果",
  },
} as const;

function FacetButton({ option, selected, language, onChange }: { option: EventFacetOption; selected: boolean; language: "en" | "zh"; onChange: (facet: EventLocalFacet) => void }) {
  return <button
    className="event-local-facet"
    type="button"
    aria-pressed={selected}
    onClick={() => onChange(option.id)}
  >
    <span>{language === "zh" ? option.labelZh : option.label}</span>
    <small>{option.count}</small>
  </button>;
}

export function EventLocalFacets({
  options,
  value,
  onChange,
}: {
  options: EventFacetOption[];
  value: EventLocalFacet;
  onChange: (facet: EventLocalFacet) => void;
}) {
  const { language } = useLanguage();
  const content = copy[language];
  if (options.length < 2) return null;
  return (
    <section className="event-local-facets" aria-labelledby="event-local-facets-title">
      <div className="event-local-facets-copy">
        <p className="eyebrow">{content.eyebrow}</p>
        <h3 id="event-local-facets-title">{content.title}</h3>
        <p>{content.body}</p>
      </div>
      <div className="event-local-facets-controls" role="group" aria-label={content.group}>
        {options.map((option) => <FacetButton key={option.id} option={option} selected={option.id === value} language={language} onChange={onChange} />)}
        {value !== "all" && (
          <button className="event-local-facet-reset" type="button" onClick={() => onChange("all")}>
            {content.reset}
          </button>
        )}
      </div>
    </section>
  );
}
