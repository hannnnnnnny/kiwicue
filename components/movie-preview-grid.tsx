import Link from "next/link";
import type { MoviePreview } from "../lib/movie-previews";
import type { Language } from "./language-provider";
import { MoviePoster } from "./movie-poster";
import { TmdbAttribution } from "./tmdb-attribution";

export type MoviePreviewState = "loading" | "ready" | "empty" | "unavailable";
export type MovieSessionCheckState = "loading" | "ready" | "empty" | "not-covered" | "unavailable";

const copy = {
  en: {
    source: "Movie previews",
    title: "Explore recent New Zealand releases",
    intro: "Posters, synopses, and trailers come from TMDB. Only films matched to the live Auckland feed carry a verified session label.",
    verified: "Verified Auckland session",
    unverified: "Auckland session not verified",
    checking: "Checking Auckland sessions",
    notCovered: "Preview only · no Auckland live-data coverage",
    checkUnavailable: "Session check unavailable",
    preview: (title: string) => `Preview ${title}`,
    noOverview: "No synopsis is available from the source yet.",
    rating: (value: number) => `TMDB ${value.toFixed(1)}`,
    datePending: "Release date to be confirmed",
    loading: "Loading movie previews",
    empty: (query: string) => `No movie previews matched “${query}”`,
    emptyDefault: "No movie previews available",
    emptyHelp: "Try another title or use an official cinema link below.",
    reset: "Clear movie search",
    unavailable: "Movie preview verification is temporarily unavailable",
    unavailableHelp: "No unverified previews are shown. Official cinema links below still work.",
    retry: "Retry movie previews",
  },
  zh: {
    source: "电影预览",
    title: "探索新西兰近期电影",
    intro: "海报、简介和预告片来自 TMDB；只有与奥克兰实时数据匹配的电影才会标注已验证场次。",
    verified: "已验证奥克兰场次",
    unverified: "奥克兰场次尚未核实",
    checking: "正在核对奥克兰场次",
    notCovered: "仅电影资料 · 暂无奥克兰实时数据覆盖",
    checkUnavailable: "暂时无法核对场次",
    preview: (title: string) => `查看 ${title} 预览`,
    noOverview: "数据源暂未提供剧情简介。",
    rating: (value: number) => `TMDB ${value.toFixed(1)}`,
    datePending: "上映日期待确认",
    loading: "正在加载电影预览",
    empty: (query: string) => `没有找到“${query}”的电影预览`,
    emptyDefault: "暂无电影预览",
    emptyHelp: "可以换一个片名，或使用下方影院官网入口。",
    reset: "清除电影搜索",
    unavailable: "电影预览验证暂时不可用",
    unavailableHelp: "未验证的预览不会显示，下方影院官网入口仍可使用。",
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

function MoviePreviewCard({ movie, language, layout, sessionStatus }: {
  movie: MoviePreview;
  language: Language;
  layout: "feature" | "standard";
  sessionStatus: "verified" | "unverified" | "checking" | "not-covered" | "unavailable";
}) {
  const content = copy[language];
  const releaseDate = formatReleaseDate(movie.releaseDate, language);
  return (
    <article className="movie-preview-card" data-layout={layout}>
      <Link href={`/movies/${movie.id}`} aria-label={content.preview(movie.title)}>
        <div className="movie-preview-poster"><MoviePoster src={movie.posterUrl} title={movie.title} language={language} /></div>
        <div className="movie-preview-body">
          <span className="movie-preview-availability" data-session-status={sessionStatus}>
            {sessionStatus === "unavailable"
              ? content.checkUnavailable
              : sessionStatus === "not-covered" ? content.notCovered : content[sessionStatus]}
          </span>
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

export function MoviePreviewGrid({ movies, state, sessionState, verifiedMovieIds, language, query, onRetry, onReset }: {
  movies: MoviePreview[];
  state: MoviePreviewState;
  sessionState: MovieSessionCheckState;
  verifiedMovieIds: ReadonlySet<number>;
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
              sessionStatus={verifiedMovieIds.has(movie.id)
                ? "verified"
                : sessionState === "loading" ? "checking"
                  : sessionState === "not-covered" ? "not-covered"
                  : sessionState === "unavailable" ? "unavailable" : "unverified"}
            />
          ))}
        </div>
      ) : null}
      {state === "empty" || state === "unavailable" ? <MoviePreviewMessage state={state} language={language} query={query} onRetry={onRetry} onReset={onReset} /> : null}
      <TmdbAttribution language={language} />
    </section>
  );
}
