"use client";

import { useState } from "react";
import type { Language } from "./language-provider";

const copy = {
  en: { unavailable: "Poster unavailable", alt: (title: string) => `${title} poster` },
  zh: { unavailable: "暂无海报", alt: (title: string) => `${title} 海报` },
} as const;

export function MoviePoster({ src, title, language, loading = "lazy" }: {
  src: string | null;
  title: string;
  language: Language;
  loading?: "eager" | "lazy";
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const content = copy[language];
  if (!src || failedSrc === src) {
    return (
      <div className="movie-poster-fallback" aria-label={content.alt(title)} role="img">
        <strong>{title}</strong>
        <span>{content.unavailable}</span>
      </div>
    );
  }
  return (
    // TMDB poster URLs are normalized to its documented image CDN by the server adapter.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={content.alt(title)} loading={loading} onError={() => setFailedSrc(src)} />
  );
}
