"use client";

import type { KiwiCueEvent } from "../lib/events";
import { EventImage } from "./event-image";
import type { Language } from "./language-provider";

const labels = {
  en: "What to expect",
  zh: "第一次去可以期待",
} as const;

type EventEditorialPreviewMediaProps = {
  event: KiwiCueEvent;
  language: Language;
  placement: "card" | "detail";
};

function localizedSummary(event: KiwiCueEvent, language: Language): string | null {
  const preview = event.editorialPreview;
  if (!preview) return null;
  return language === "zh"
    ? event.localization?.zh?.previewSummary ?? preview.summary
    : preview.summary;
}

function localizedAlt(event: KiwiCueEvent, language: Language): string {
  const image = event.editorialPreview?.image;
  if (!image) return "";
  return language === "zh"
    ? event.localization?.zh?.previewImageAlt ?? image.alt
    : image.alt;
}

export function EventEditorialPreviewMedia({
  event,
  language,
  placement,
}: EventEditorialPreviewMediaProps) {
  const summary = localizedSummary(event, language);
  const imageUrl = event.editorialPreview?.image?.url ?? event.imageUrl;
  if (!imageUrl && !summary) return null;

  const fallback = summary ? (
    <span className="event-editorial-fallback">
      <strong>{labels[language]}</strong>
      <span>{summary}</span>
    </span>
  ) : null;

  return (
    <div className={`${placement === "card" ? "portal-event-media" : "event-detail-media"} event-editorial-preview event-editorial-preview-${placement}`}>
      <EventImage
        src={imageUrl}
        alt={placement === "detail" ? localizedAlt(event, language) : ""}
        fallback={fallback}
        loading={placement === "detail" ? "eager" : "lazy"}
      />
    </div>
  );
}
