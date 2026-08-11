import type { Language } from "./language-provider";

const copy = {
  en: {
    label: "Movie data credits",
    explanation: "Movie metadata, artwork, and trailers are supplied by TMDB.",
  },
  zh: {
    label: "电影数据来源",
    explanation: "电影资料、海报和预告片由 TMDB 提供。",
  },
} as const;

const NOTICE = "This product uses the TMDB API but is not endorsed or certified by TMDB.";
const LOGO_URL = "https://www.themoviedb.org/assets/2/v4/logos/v2/blue_square_1-5bdc75aaebeb75dc7ae79426ddd9be3b2be1e342510f8202baf6bffa71d7f5c4.svg";

export function TmdbAttribution({ language }: { language: Language }) {
  const content = copy[language];
  return (
    <aside className="tmdb-attribution" aria-label={content.label}>
      <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer noopener">
        {/* This is TMDB's approved primary short logo from its attribution page. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO_URL} alt="TMDB" loading="lazy" />
      </a>
      <div>
        <p>{content.explanation}</p>
        {language === "zh" ? <p>本产品使用 TMDB API，但未经 TMDB 认可或认证。</p> : null}
        <p>{NOTICE}</p>
      </div>
    </aside>
  );
}
