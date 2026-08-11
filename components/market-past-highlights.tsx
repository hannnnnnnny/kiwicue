import type { KiwiCueEventDetail } from "../lib/events";
import type { Language } from "./language-provider";

const copy = {
  en: {
    title: "Past highlights",
    source: "Open official past preview",
    caveat: "Stalls and products can change from week to week.",
  },
  zh: {
    title: "往期精选",
    source: "查看官方往期预览",
    caveat: "每周摊位和商品可能不同，请以当天现场为准。",
  },
} as const;

function localizedPreview(event: KiwiCueEventDetail, language: Language) {
  const preview = event.editorialPreview;
  if (!preview) return null;
  if (language === "en") {
    return { summary: preview.summary, highlights: preview.highlights };
  }
  return {
    summary: event.localization?.zh?.previewSummary ?? preview.summary,
    highlights: event.localization?.zh?.previewHighlights ?? preview.highlights,
  };
}

export function MarketPastHighlights({
  event,
  language,
}: {
  event: KiwiCueEventDetail;
  language: Language;
}) {
  const preview = localizedPreview(event, language);
  if (!preview) return null;
  const content = copy[language];
  const sourceUrl = event.editorialPreview?.image?.sourceUrl ?? event.source?.url;

  return (
    <section
      className="event-detail-section event-market-highlights"
      aria-labelledby="market-past-highlights-title"
    >
      <h2 id="market-past-highlights-title">{content.title}</h2>
      <div className="event-market-highlights-copy">
        <p>{preview.summary}</p>
        <ul>
          {preview.highlights.map((highlight) => (
            <li key={highlight}>{highlight}</li>
          ))}
        </ul>
        <p className="event-market-highlights-caveat">{content.caveat}</p>
        {sourceUrl && (
          <a href={sourceUrl} target="_blank" rel="noreferrer noopener">
            {content.source}<span aria-hidden="true"> ↗</span>
          </a>
        )}
      </div>
    </section>
  );
}
