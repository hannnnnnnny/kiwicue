"use client";

import type { EventExperienceGuide, EventExperienceSection } from "../lib/events";
import type { Language } from "./language-provider";

const copy = {
  en: {
    title: "Experience guide",
    source: "Source",
    checked: (date: string) => `Checked ${date}`,
    scope: "Scope",
    excerpt: "Reported excerpt",
  },
  zh: {
    title: "体验指南",
    source: "来源",
    checked: (date: string) => `核对时间：${date}`,
    scope: "适用范围",
    excerpt: "报道节选",
  },
} as const;

function sectionText(section: EventExperienceSection, language: Language) {
  return {
    heading: language === "zh" ? section.headingZh : section.heading,
    summary: language === "zh" ? section.summaryZh : section.summary,
    points: language === "zh" ? section.pointsZh ?? section.points : section.points,
    disclosure: language === "zh" ? section.disclosureZh : section.disclosure,
    caveat: language === "zh" ? section.caveatZh : section.caveat,
  };
}

function GuideSource({ section, language }: { section: EventExperienceSection; language: Language }) {
  const content = copy[language];
  return (
    <footer className="event-experience-source">
      <span>{content.source}</span>
      <a href={section.source.url} target="_blank" rel="noreferrer noopener">
        {section.source.name}<span aria-hidden="true"> ↗</span>
      </a>
      <span>{content.checked(section.source.checkedAt)}</span>
      <span>{content.scope}: {section.source.scope}</span>
    </footer>
  );
}

function ExperienceSection({ section, language, index }: { section: EventExperienceSection; language: Language; index: number }) {
  const content = copy[language];
  const text = sectionText(section, language);
  const headingId = `event-experience-heading-${index}`;
  return (
    <article className={`event-experience-item event-experience-${section.kind}`} aria-labelledby={headingId}>
      <h3 id={headingId}>{text.heading}</h3>
      <p>{text.summary}</p>
      {text.points && text.points.length > 0 ? <ul>{text.points.map((point) => <li key={point}>{point}</li>)}</ul> : null}
      {section.songs && text.disclosure ? (
        <details className="event-experience-excerpt">
          <summary>{text.disclosure}</summary>
          <div>
            <span className="event-experience-excerpt-label">{content.excerpt}</span>
            <ol>{section.songs.map((song) => <li key={song}>{song}</li>)}</ol>
          </div>
        </details>
      ) : null}
      {text.caveat ? <p className="event-experience-caveat">{text.caveat}</p> : null}
      <GuideSource section={section} language={language} />
      {section.links && section.links.length > 0 ? (
        <div className="event-experience-links">
          {section.links.map((item) => <a key={item.url} href={item.url} target="_blank" rel="noreferrer noopener">
            {language === "zh" ? item.labelZh : item.label}<span aria-hidden="true"> ↗</span>
          </a>)}
        </div>
      ) : null}
    </article>
  );
}

export function EventExperienceGuide({ guide, language }: { guide: EventExperienceGuide; language: Language }) {
  const content = copy[language];
  if (guide.sections.length === 0) return null;
  return (
    <section className="event-detail-section event-experience-guide" aria-labelledby="event-experience-guide-title">
      <h2 id="event-experience-guide-title">{content.title}</h2>
      <div className="event-experience-list">
        {guide.sections.map((section, index) => <ExperienceSection key={`${section.kind}-${section.heading}`} section={section} language={language} index={index} />)}
      </div>
    </section>
  );
}
