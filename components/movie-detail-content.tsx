"use client";

import { BackLink } from "./back-link";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AUCKLAND_CINEMAS } from "../lib/cinema-directory";
import { isTrustedOfficialBookingUrl } from "../lib/official-booking";
import { CINEMA_CHAINS, type CinemaChain, type KiwiCueScreening, type ScreeningPrice } from "../lib/movies";
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
  | { status: "ready"; language: Language; movie: MoviePreviewDetail; sessionStatus: MovieSessionStatus; screenings: KiwiCueScreening[]; unavailableChains: CinemaChain[]; checkedAt: string | null }
  | { status: "not-found" }
  | { status: "error" };

// HOYTS and EVENT sessions are listed live above; the directory covers everyone else.
const INDEPENDENT_CINEMAS = AUCKLAND_CINEMAS.filter((cinema) => cinema.chain !== "HOYTS" && cinema.chain !== "EVENT Cinemas");
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

function isChain(value: unknown): value is CinemaChain {
  return CINEMA_CHAINS.includes(value as CinemaChain);
}

function isPrice(value: unknown): value is ScreeningPrice {
  return isRecord(value) && typeof value.minCents === "number" && typeof value.maxCents === "number"
    && value.minCents >= 0 && value.maxCents >= value.minCents
    && (value.bookingFeeCents === null || typeof value.bookingFeeCents === "number");
}

function isScreening(value: unknown): value is KiwiCueScreening {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.filmId === "string" && typeof value.filmTitle === "string"
    && (value.filmRating === null || typeof value.filmRating === "string")
    && (value.runtimeMinutes === null || typeof value.runtimeMinutes === "number")
    && typeof value.cinemaId === "string" && typeof value.cinemaName === "string" && isChain(value.chain)
    && typeof value.startTime === "string" && Number.isFinite(Date.parse(value.startTime))
    && typeof value.screenType === "string"
    && Array.isArray(value.formats) && value.formats.every((format) => typeof format === "string")
    && typeof value.soldOut === "boolean" && typeof value.discounted === "boolean"
    && (value.price === null || isPrice(value.price))
    && (value.bookingUrl === null || isTrustedOfficialBookingUrl(value.bookingUrl));
}

function isDetailResponse(value: unknown, movieId: string): value is MoviePreviewDetailResponse {
  if (!isRecord(value) || !isRecord(value.movie) || String(value.movie.id) !== movieId) return false;
  const status = value.sessionStatus;
  const validStatus = status === "verified" || status === "unverified" || status === "unavailable";
  const validScreenings = value.screenings === undefined || Array.isArray(value.screenings) && value.screenings.every(isScreening);
  const validChains = value.unavailableChains === undefined
    || Array.isArray(value.unavailableChains) && value.unavailableChains.every(isChain);
  const validCheckedAt = value.checkedAt === undefined || value.checkedAt === null
    || typeof value.checkedAt === "string" && Number.isFinite(Date.parse(value.checkedAt));
  return validStatus && validScreenings && validChains && validCheckedAt;
}

const copy = {
  en: {
    loading: "Loading movie preview",
    back: "Back",
    source: {
      verified: "Showing in Auckland",
      unverified: "Movie preview",
      unavailable: "Movie preview · Session check unavailable",
    },
    availability: {
      verified: "See which cinemas are showing it, session times and ticket prices below.",
      unverified: "No HOYTS or EVENT Cinemas sessions this week. Independent cinemas are listed below.",
      unavailable: "Live sessions could not be checked. Use the official cinema links below before planning your trip.",
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
    cinemas: "More Auckland cinemas",
    cinemasHelp: "Independent cinemas aren't in the live sessions above. Check their official sites for this film.",
    notFound: "Movie preview not found",
    notFoundBody: "This movie is not available from the preview source.",
    browse: "Browse movie previews",
    error: "Movie preview is temporarily unavailable",
    errorBody: "The movie source could not be refreshed. The cinema directory is still available on the movies page.",
    retry: "Retry movie preview",
    footer: "Pick a session, then book with the cinema.",
  },
  zh: {
    loading: "正在加载电影预览",
    back: "返回",
    source: {
      verified: "奥克兰正在上映",
      unverified: "电影预览",
      unavailable: "电影预览 · 暂时无法核对场次",
    },
    availability: {
      verified: "下方可以查看哪些影院在放映、场次时间和票价。",
      unverified: "本周 HOYTS 和 EVENT Cinemas 暂无场次，独立影院见下方列表。",
      unavailable: "暂时无法核对实时场次，出发前请使用下方影院官网确认。",
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
    cinemas: "更多奥克兰影院",
    cinemasHelp: "独立影院不在上方实时场次中，请到它们的官网查看这部电影。",
    notFound: "未找到电影预览",
    notFoundBody: "电影预览数据源暂未提供这部电影。",
    browse: "浏览电影预览",
    error: "电影预览暂时不可用",
    errorBody: "电影数据暂时无法刷新，影院目录仍可在电影页面使用。",
    retry: "重新加载电影预览",
    footer: "选好场次，再到影院官网订票。",
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

function MovieReady({ movie, language, sessionStatus, screenings, unavailableChains, checkedAt }: {
  movie: MoviePreviewDetail;
  language: Language;
  sessionStatus: MovieSessionStatus;
  screenings: KiwiCueScreening[];
  unavailableChains: CinemaChain[];
  checkedAt: string | null;
}) {
  const content = copy[language];
  return (
    <article id="movie-detail" className="movie-detail-shell" aria-labelledby="movie-detail-title">
      <BackLink label={content.back} className="movie-detail-back" fallback="/movies">← {content.back}</BackLink>
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
      <MovieDetailSessions screenings={screenings} sessionStatus={sessionStatus} checkedAt={checkedAt} unavailableChains={unavailableChains} language={language} />
      <MovieTrailer movie={movie} language={language} />
      <section className="movie-detail-cinemas" aria-labelledby="movie-cinemas-title">
        <header><h2 id="movie-cinemas-title">{content.cinemas}</h2><p>{content.cinemasHelp}</p></header>
        <CinemaDirectory cinemas={INDEPENDENT_CINEMAS} language={language} />
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
    requestMovieDetail(movieId, language).then(({ movie, sessionStatus, screenings = [], unavailableChains = [], checkedAt = null }) => {
      if (active) setState({ status: "ready", language, movie, sessionStatus, screenings, unavailableChains, checkedAt });
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
      {isCurrent ? <MovieReady movie={state.movie} language={language} sessionStatus={state.sessionStatus} screenings={state.screenings} unavailableChains={state.unavailableChains} checkedAt={state.checkedAt} /> : (
        <MovieDetailState state={displayState} language={language} onRetry={() => {
          setState({ status: "loading" });
          setAttempt((value) => value + 1);
        }} />
      )}
      <footer className="portal-footer"><span>KiwiCue / 纽村小报</span><span>{content.footer}</span></footer>
    </main>
  );
}
