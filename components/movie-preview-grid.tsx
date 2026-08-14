import Link from "next/link";
import type { MoviePreview } from "../lib/movie-previews";
import type { Language } from "./language-provider";
import { MoviePoster } from "./movie-poster";
import { TmdbAttribution } from "./tmdb-attribution";

export type MoviePreviewState = "loading" | "ready" | "empty" | "unavailable";

const copy = {
  en: {
    source: "Movie previews",
    title: "Now playing in New Zealand",
    intro: "Choose a film, read the synopsis, and watch its trailer before checking an Auckland cinema.",
    preview: (title: string) => `Preview ${title}`,
    noOverview: "No synopsis is available from the source yet.",
    rating: (value: number) => `TMDB ${value.toFixed(1)}`,
    datePending: "Release date to be confirmed",
    loading: "Loading movie previews",
    empty: (query: string) => `No movies matched “${query}”`,
    emptyDefault: "No current movies were returned",
    emptyHelp: "Try another title or use the cinema directory below.",
    reset: "Clear movie search",
    unavailable: "Movie previews are temporarily unavailable",
    unavailableHelp: "Live sessions and official cinema links below still work.",
    retry: "Retry movie previews",
  },
  zh: {
    source: "电影预览",
    title: "新西兰近期电影",
    intro: "先看海报、简介和预告片，再到奥克兰影院官网确认场次。",
    preview: (title: string) => `查看 ${title} 预览`,
    noOverview: "数据源暂未提供剧情简介。",
    rating: (value: number) => `TMDB ${value.toFixed(1)}`,
    datePending: "上映日期待确认",
    loading: "正在加载电影预览",
    empty: (query: string) => `没有找到“${query}”`,
    emptyDefault: "暂未返回近期电影",
    emptyHelp: "可以换一个片名，或使用下方影院目录。",
    reset: "清除电影搜索",
    unavailable: "电影预览暂时不可用",
    unavailableHelp: "下方实时场次和影院官网入口仍可使用。",
    retry: "重新加载电影预览",
  },
} as const;

function formatReleaseDate(value: string | null, language: Language): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-NZ", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

function MoviePreviewCard({ movie, language, layout }: {
  movie: MoviePreview;
  language: Language;
  layout: "feature" | "standard";
}) {
  const content = copy[language];
  const releaseDate = formatReleaseDate(movie.releaseDate, language);
  return (
    <article className="movie-preview-card" data-layout={layout}>
      <Link href={`/movies/${movie.id}`} aria-label={content.preview(movie.title)}>
        <div className="movie-preview-poster"><MoviePoster src={movie.posterUrl} title={movie.title} language={language} /></div>
        <div className="movie-preview-body">
          <h3>{movie.title}</h3>
          <div className="movie-preview-meta">
            <span>{releaseDate ?? content.datePending}</span>
            {movie.rating === null ? null : <span>{content.rating(movie.rating)}</span>}
          </div>
          <p>{movie.overview ?? content.noOverview}</p>
          <strong>{content.preview(movie.title)}<span aria-hidden="true"> ↗</span></strong>
        </div>
      </Link>
    </article>
  );
}

function MoviePreviewSkeletons({ label }: { label: string }) {
  return (
    <div className="movie-preview-skeletons" role="status" aria-label={label} aria-live="polite">
      {[0, 1, 2, 3].map((item) => (
        <div className="movie-preview-skeleton" key={item} aria-hidden="true">
          <span /><span /><span /><span />
        </div>
      ))}
    </div>
  );
}

function MoviePreviewMessage({ state, language, query, onRetry, onReset }: {
  state: "empty" | "unavailable";
  language: Language;
  query: string | null;
  onRetry: () => void;
  onReset: () => void;
}) {
  const content = copy[language];
  const title = state === "unavailable"
    ? content.unavailable
    : query ? content.empty(query) : content.emptyDefault;
  return (
    <div className="movie-preview-message" role={state === "unavailable" ? "alert" : "status"}>
      <h3>{title}</h3>
      <p>{state === "unavailable" ? content.unavailableHelp : content.emptyHelp}</p>
      <button type="button" onClick={state === "unavailable" ? onRetry : onReset}>
        {state === "unavailable" ? content.retry : content.reset}
      </button>
    </div>
  );
}

export function MoviePreviewGrid({ movies, state, language, query, onRetry, onReset }: {
  movies: MoviePreview[];
  state: MoviePreviewState;
  language: Language;
  query: string | null;
  onRetry: () => void;
  onReset: () => void;
}) {
  const content = copy[language];
  return (
    <section className="movie-preview-section" id="movie-previews" aria-labelledby="movie-preview-title">
      <header>
        <p className="eyebrow">{content.source}</p>
        <h2 className="editorial-display" id="movie-preview-title">{content.title}</h2>
        <p>{content.intro}</p>
      </header>
      {state === "loading" ? <MoviePreviewSkeletons label={content.loading} /> : null}
      {state === "ready" ? (
        <div className="movie-preview-grid">
          {movies.map((movie, index) => (
            <MoviePreviewCard
              key={movie.id}
              movie={movie}
              language={language}
              layout={index === 0 ? "feature" : "standard"}
            />
          ))}
        </div>
      ) : null}
      {state === "empty" || state === "unavailable" ? <MoviePreviewMessage state={state} language={language} query={query} onRetry={onRetry} onReset={onReset} /> : null}
      <TmdbAttribution language={language} />
    </section>
  );
}
