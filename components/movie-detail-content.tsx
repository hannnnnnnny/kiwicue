"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AUCKLAND_CINEMAS } from "../lib/cinema-directory";
import type { MoviePreviewDetail } from "../lib/movie-previews";
import { CinemaDirectory } from "./cinema-directory";
import { useLanguage, type Language } from "./language-provider";
import { MoviePoster } from "./movie-poster";
import { PortalHeader } from "./portal-header";
import { TmdbAttribution } from "./tmdb-attribution";

type DetailState =
  | { status: "loading" }
  | { status: "ready"; movie: MoviePreviewDetail }
  | { status: "not-found" }
  | { status: "error" };

const TRAILER_KEY_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;

export class MovieDetailRequestError extends Error {
  constructor(public readonly status: number) {
    super(`MOVIE_DETAIL_${status}`);
    this.name = "MovieDetailRequestError";
  }
}

export async function requestMovieDetailFromApi(
  movieId: string,
  language: Language,
): Promise<MoviePreviewDetail> {
  const response = await fetch(`/api/movie-previews/${encodeURIComponent(movieId)}?language=${language}`, {
    headers: { accept: "application/json" },
  });
  const payload = await response.json() as { movie?: MoviePreviewDetail };
  if (!response.ok || !payload.movie || String(payload.movie.id) !== movieId) {
    throw new MovieDetailRequestError(response.status);
  }
  return payload.movie;
}

const copy = {
  en: {
    loading: "Loading movie preview",
    back: "Back to movies",
    source: "New Zealand movie preview",
    rating: (value: number) => `TMDB rating ${value.toFixed(1)}`,
    datePending: "Release date to be confirmed",
    synopsis: "Synopsis",
    noOverview: "No synopsis is available from the source yet.",
    trailer: "Official trailer",
    trailerTitle: (title: string) => `${title} official trailer`,
    openTrailer: "Open trailer on YouTube",
    noTrailer: "No official trailer is currently available",
    noTrailerHelp: "You can still review the synopsis and check official cinema sessions below.",
    cinemas: "Check Auckland cinema sessions",
    cinemasHelp: "Confirm that this film is showing and choose a session on each cinema's official website.",
    notFound: "Movie not found",
    notFoundBody: "This movie may have been removed or its source listing may have changed.",
    browse: "Browse movies",
    error: "Movie preview is temporarily unavailable",
    errorBody: "The movie source could not be refreshed. The cinema directory is still available on the movies page.",
    retry: "Retry movie preview",
    footer: "Preview the film, then confirm the session with the cinema.",
  },
  zh: {
    loading: "正在加载电影预览",
    back: "返回电影页面",
    source: "新西兰电影预览",
    rating: (value: number) => `TMDB 评分 ${value.toFixed(1)}`,
    datePending: "上映日期待确认",
    synopsis: "剧情简介",
    noOverview: "数据源暂未提供剧情简介。",
    trailer: "官方预告片",
    trailerTitle: (title: string) => `${title} 官方预告片`,
    openTrailer: "在 YouTube 打开预告片",
    noTrailer: "暂未提供官方预告片",
    noTrailerHelp: "你仍可查看剧情简介，并在下方影院官网确认场次。",
    cinemas: "查看奥克兰影院场次",
    cinemasHelp: "请在各影院官网确认该电影是否上映并选择场次。",
    notFound: "没有找到这部电影",
    notFoundBody: "该电影可能已被移除，或数据源信息已经改变。",
    browse: "浏览电影",
    error: "电影预览暂时不可用",
    errorBody: "电影数据暂时无法刷新，影院目录仍可在电影页面使用。",
    retry: "重新加载电影预览",
    footer: "先预览电影，再到影院官网确认场次。",
  },
} as const;

function formatDate(value: string | null, language: Language): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-NZ", {
    timeZone: "UTC", day: "numeric", month: "short", year: "numeric",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatRuntime(minutes: number, language: Language): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (language === "zh") return hours > 0 ? `${hours}小时${remainder}分钟` : `${remainder}分钟`;
  return hours > 0 ? `${hours} hr ${remainder} min` : `${remainder} min`;
}

function MovieTrailer({ movie, language }: { movie: MoviePreviewDetail; language: Language }) {
  const content = copy[language];
  const key = movie.trailerKey && TRAILER_KEY_PATTERN.test(movie.trailerKey) ? movie.trailerKey : null;
  if (!key) {
    return <div className="movie-trailer-empty"><h2>{content.noTrailer}</h2><p>{content.noTrailerHelp}</p></div>;
  }
  return (
    <section className="movie-trailer" aria-labelledby="movie-trailer-title">
      <h2 id="movie-trailer-title">{content.trailer}</h2>
      <div className="movie-trailer-frame">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${key}`}
          title={content.trailerTitle(movie.title)}
          loading="lazy"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <a href={`https://www.youtube.com/watch?v=${key}`} target="_blank" rel="noreferrer noopener">{content.openTrailer}<span aria-hidden="true"> ↗</span></a>
    </section>
  );
}

function MovieFacts({ movie, language }: { movie: MoviePreviewDetail; language: Language }) {
  const content = copy[language];
  const facts = [
    formatDate(movie.releaseDate, language) ?? content.datePending,
    movie.runtimeMinutes === null ? null : formatRuntime(movie.runtimeMinutes, language),
    movie.certification,
    movie.rating === null ? null : content.rating(movie.rating),
    ...movie.genres,
  ].filter((fact): fact is string => Boolean(fact));
  return <ul className="movie-detail-facts">{facts.map((fact) => <li key={fact}>{fact}</li>)}</ul>;
}

function MovieReady({ movie, language }: { movie: MoviePreviewDetail; language: Language }) {
  const content = copy[language];
  return (
    <article id="movie-detail" className="movie-detail-shell" aria-labelledby="movie-detail-title">
      <Link aria-label={content.back} className="movie-detail-back" href="/movies">← {content.back}</Link>
      <div className="movie-detail-hero">
        <div className="movie-detail-poster"><MoviePoster src={movie.posterUrl} title={movie.title} language={language} loading="eager" /></div>
        <div className="movie-detail-summary">
          <p className="eyebrow">{content.source}</p>
          <h1 className="editorial-display" id="movie-detail-title">{movie.title}</h1>
          {movie.originalTitle ? <p className="movie-original-title">{movie.originalTitle}</p> : null}
          <MovieFacts movie={movie} language={language} />
          <section className="movie-synopsis" aria-labelledby="movie-synopsis-title">
            <h2 id="movie-synopsis-title">{content.synopsis}</h2>
            <p>{movie.overview ?? content.noOverview}</p>
          </section>
          <TmdbAttribution language={language} />
        </div>
      </div>
      <MovieTrailer movie={movie} language={language} />
      <section className="movie-detail-cinemas" aria-labelledby="movie-cinemas-title">
        <header><h2 id="movie-cinemas-title">{content.cinemas}</h2><p>{content.cinemasHelp}</p></header>
        <CinemaDirectory cinemas={AUCKLAND_CINEMAS} language={language} />
      </section>
    </article>
  );
}

function MovieDetailState({ state, language, onRetry }: {
  state: Exclude<DetailState, { status: "ready" }>;
  language: Language;
  onRetry: () => void;
}) {
  const content = copy[language];
  if (state.status === "loading") {
    return <section id="movie-detail" className="movie-detail-state movie-detail-loading" role="status" aria-busy="true"><p>{content.loading}</p><div aria-hidden="true"><span /><span /><span /></div></section>;
  }
  const notFound = state.status === "not-found";
  return (
    <section id="movie-detail" className="movie-detail-state" role="alert">
      <h1 className="editorial-display">{notFound ? content.notFound : content.error}</h1>
      <p>{notFound ? content.notFoundBody : content.errorBody}</p>
      {notFound ? <Link href="/movies">{content.browse}</Link> : <button type="button" onClick={onRetry}>{content.retry}</button>}
    </section>
  );
}

export function MovieDetailContent({ movieId, requestMovieDetail = requestMovieDetailFromApi }: {
  movieId: string;
  requestMovieDetail?: (movieId: string, language: Language) => Promise<MoviePreviewDetail>;
}) {
  const { language } = useLanguage();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DetailState>({ status: "loading" });
  useEffect(() => {
    let active = true;
    requestMovieDetail(movieId, language).then((movie) => {
      if (active) setState({ status: "ready", movie });
    }).catch((error: unknown) => {
      if (active) setState(error instanceof MovieDetailRequestError && error.status === 404 ? { status: "not-found" } : { status: "error" });
    });
    return () => { active = false; };
  }, [attempt, language, movieId, requestMovieDetail]);

  const content = copy[language];
  return (
    <main className="movie-detail-page">
      <PortalHeader currentPage="movies" skipTarget="movie-detail" />
      {state.status === "ready" ? <MovieReady movie={state.movie} language={language} /> : (
        <MovieDetailState state={state} language={language} onRetry={() => {
          setState({ status: "loading" });
          setAttempt((value) => value + 1);
        }} />
      )}
      <footer className="portal-footer"><span>KiwiCue / 纽村小报</span><span>{content.footer}</span></footer>
    </main>
  );
}
