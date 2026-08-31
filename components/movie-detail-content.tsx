"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AUCKLAND_CINEMAS } from "../lib/cinema-directory";
import { isTrustedOfficialBookingUrl } from "../lib/official-booking";
import type { KiwiCueScreening } from "../lib/movies";
import type {
  MoviePreviewDetail,
  MoviePreviewDetailResponse,
  MovieSessionStatus,
} from "../lib/movie-previews";
import { CinemaDirectory } from "./cinema-directory";
import { useLanguage, type Language } from "./language-provider";
import { MoviePoster } from "./movie-poster";
import { MovieDetailSessions } from "./movie-detail-sessions";
import { PortalHeader } from "./portal-header";
import { TmdbAttribution } from "./tmdb-attribution";

type DetailState =
  | { status: "loading" }
  | { status: "ready"; language: Language; movie: MoviePreviewDetail; sessionStatus: MovieSessionStatus; screenings: KiwiCueScreening[]; checkedAt: string | null }
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
): Promise<MoviePreviewDetailResponse> {
  const response = await fetch(`/api/movie-previews/${encodeURIComponent(movieId)}?language=${language}`, {
    headers: { accept: "application/json" },
  });
  const payload: unknown = await response.json();
  if (!response.ok || !isDetailResponse(payload, movieId)) {
    throw new MovieDetailRequestError(response.status);
  }
  return payload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isScreening(value: unknown): value is KiwiCueScreening {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.filmId === "string" && typeof value.filmTitle === "string"
    && (value.filmRating === null || typeof value.filmRating === "string")
    && (value.runtimeMinutes === null || typeof value.runtimeMinutes === "number")
    && typeof value.cinemaId === "string" && typeof value.cinemaName === "string"
    && typeof value.startTime === "string" && Number.isFinite(Date.parse(value.startTime))
    && Array.isArray(value.formats) && value.formats.every((format) => typeof format === "string")
    && typeof value.soldOut === "boolean"
    && (value.distanceKilometres === null || typeof value.distanceKilometres === "number")
    && (value.bookingUrl === null || isTrustedOfficialBookingUrl(value.bookingUrl));
}

function isDetailResponse(value: unknown, movieId: string): value is MoviePreviewDetailResponse {
  if (!isRecord(value) || !isRecord(value.movie) || String(value.movie.id) !== movieId) return false;
  const status = value.sessionStatus;
  const validStatus = status === "verified" || status === "unverified" || status === "not-covered" || status === "unavailable";
  const validScreenings = value.screenings === undefined || Array.isArray(value.screenings) && value.screenings.every(isScreening);
  const validCheckedAt = value.checkedAt === undefined || value.checkedAt === null
    || typeof value.checkedAt === "string" && Number.isFinite(Date.parse(value.checkedAt));
  return validStatus && validScreenings && validCheckedAt;
}

const copy = {
  en: {
    loading: "Loading movie preview",
    back: "Back to movies",
    source: {
      verified: "Source-matched Auckland sessions",
      unverified: "Release preview · Auckland session not verified",
      "not-covered": "Release preview · Auckland live-data coverage unavailable",
      unavailable: "Release preview · Session check unavailable",
    },
    availability: {
      verified: "Source title and runtime matched; this is not an exact cross-source identity proof. Confirm final availability on the cinema's official site.",
      unverified: "Use the official cinema links below to confirm whether this film is currently showing.",
      "not-covered": "The authorized data provider does not currently cover Auckland. This does not mean the film is not showing; check an official cinema site below.",
      unavailable: "The live Auckland session source could not be checked. Use the official cinema links below before planning your trip.",
    },
    rating: (value: number) => `TMDB rating ${value.toFixed(1)}`,
    datePending: "Release date to be confirmed",
    synopsis: "Synopsis",
    noOverview: "No synopsis is available from the source yet.",
    trailer: "Official trailer",
    trailerTitle: (title: string) => `${title} official trailer`,
    openTrailer: "Open trailer on YouTube",
    noTrailer: "No official trailer is currently available",
    noTrailerHelp: "You can still review the synopsis and check official cinema sessions below.",
    cinemas: "General Auckland cinema directory",
    cinemasHelp: "This is a general lookup, not a list of cinemas showing this film. Confirm sessions on each official website.",
    notFound: "Movie preview not found",
    notFoundBody: "This movie is not available from the preview source.",
    browse: "Browse movie previews",
    error: "Movie preview is temporarily unavailable",
    errorBody: "The movie source could not be refreshed. The cinema directory is still available on the movies page.",
    retry: "Retry movie preview",
    footer: "Preview the film, then confirm the session with the cinema.",
  },
  zh: {
    loading: "正在加载电影预览",
    back: "返回电影页面",
    source: {
      verified: "来源匹配的奥克兰场次",
      unverified: "电影预览 · 奥克兰场次尚未核实",
      "not-covered": "电影预览 · 暂无奥克兰实时数据覆盖",
      unavailable: "电影预览 · 暂时无法核对场次",
    },
    availability: {
      verified: "已匹配来源片名和片长，并非跨来源身份的绝对证明；最终余票和时间请以影院官网为准。",
      unverified: "请使用下方影院官网入口确认这部电影目前是否上映。",
      "not-covered": "授权数据源目前尚未覆盖奥克兰；这不代表电影没有上映，请使用下方影院官网核实。",
      unavailable: "奥克兰实时场次源暂时无法核对，出发前请使用下方影院官网确认。",
    },
    rating: (value: number) => `TMDB 评分 ${value.toFixed(1)}`,
    datePending: "上映日期待确认",
    synopsis: "剧情简介",
    noOverview: "数据源暂未提供剧情简介。",
    trailer: "官方预告片",
    trailerTitle: (title: string) => `${title} 官方预告片`,
    openTrailer: "在 YouTube 打开预告片",
    noTrailer: "暂未提供官方预告片",
    noTrailerHelp: "你仍可查看剧情简介，并在下方影院官网确认场次。",
    cinemas: "奥克兰通用影院目录",
    cinemasHelp: "这是通用查找目录，并非正在放映本片的影院列表；请到各影院官网确认场次。",
    notFound: "未找到电影预览",
    notFoundBody: "电影预览数据源暂未提供这部电影。",
    browse: "浏览电影预览",
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

function MovieReady({ movie, language, sessionStatus, screenings, checkedAt }: {
  movie: MoviePreviewDetail;
  language: Language;
  sessionStatus: MovieSessionStatus;
  screenings: KiwiCueScreening[];
  checkedAt: string | null;
}) {
  const content = copy[language];
  return (
    <article id="movie-detail" className="movie-detail-shell" aria-labelledby="movie-detail-title">
      <Link aria-label={content.back} className="movie-detail-back" href="/movies">← {content.back}</Link>
      <div className="movie-detail-hero">
        <div className="movie-detail-poster"><MoviePoster src={movie.posterUrl} title={movie.title} language={language} loading="eager" /></div>
        <div className="movie-detail-summary">
          <p className="eyebrow">{content.source[sessionStatus]}</p>
          <h1 className="editorial-display" id="movie-detail-title">{movie.title}</h1>
          <p className="movie-availability-note">{content.availability[sessionStatus]}</p>
          {movie.originalTitle ? <p className="movie-original-title">{movie.originalTitle}</p> : null}
          <MovieFacts movie={movie} language={language} />
          <section className="movie-synopsis" aria-labelledby="movie-synopsis-title">
            <h2 id="movie-synopsis-title">{content.synopsis}</h2>
            <p>{movie.overview ?? content.noOverview}</p>
          </section>
          <TmdbAttribution language={language} />
        </div>
      </div>
      <MovieDetailSessions screenings={screenings} sessionStatus={sessionStatus} checkedAt={checkedAt} language={language} />
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
  requestMovieDetail?: (movieId: string, language: Language) => Promise<MoviePreviewDetailResponse>;
}) {
  const { language } = useLanguage();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DetailState>({ status: "loading" });
  useEffect(() => {
    let active = true;
    requestMovieDetail(movieId, language).then(({ movie, sessionStatus, screenings = [], checkedAt = null }) => {
      if (active) setState({ status: "ready", language, movie, sessionStatus, screenings, checkedAt });
    }).catch((error: unknown) => {
      if (active) setState(error instanceof MovieDetailRequestError && error.status === 404 ? { status: "not-found" } : { status: "error" });
    });
    return () => { active = false; };
  }, [attempt, language, movieId, requestMovieDetail]);

  const content = copy[language];
  const isCurrent = state.status === "ready" && state.movie.id === Number(movieId) && state.language === language;
  const displayState: Exclude<DetailState, { status: "ready" }> = state.status === "ready"
    ? { status: "loading" }
    : state;
  return (
    <main className="movie-detail-page">
      <PortalHeader currentPage="movies" skipTarget="movie-detail" />
      {isCurrent ? <MovieReady movie={state.movie} language={language} sessionStatus={state.sessionStatus} screenings={state.screenings} checkedAt={state.checkedAt} /> : (
        <MovieDetailState state={displayState} language={language} onRetry={() => {
          setState({ status: "loading" });
          setAttempt((value) => value + 1);
        }} />
      )}
      <footer className="portal-footer"><span>KiwiCue / 纽村小报</span><span>{content.footer}</span></footer>
    </main>
  );
}
