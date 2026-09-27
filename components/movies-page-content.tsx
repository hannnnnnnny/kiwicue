"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  AUCKLAND_CINEMAS,
  filterCinemas,
  sortCinemasByDistance,
} from "../lib/cinema-directory";
import { parseMovieQuery } from "../lib/movie-search-params";
import type { CinemaChain, MovieDateFilter, MovieShowing } from "../lib/movies";
import type { MoviePreview, MoviePreviewPage } from "../lib/movie-previews";
import { filterShowingMoviePreviews, normalizedMovieTitle } from "../lib/verified-movie-sessions";
import { CinemaDirectory } from "./cinema-directory";
import { useLanguage } from "./language-provider";
import { MovieScreeningFeed, type MovieFeedState } from "./movie-screening-feed";
import { MovieSearchPanel } from "./movie-search-panel";
import { MoviePreviewGrid, type MoviePreviewState } from "./movie-preview-grid";
import { PortalHeader } from "./portal-header";

type FeedResponse = {
  films: MovieShowing[];
  sourceState: "ready" | "empty" | "unavailable";
  unavailableChains: CinemaChain[];
  checkedAt: string;
};

type PreviewResponse = {
  localized: MoviePreviewPage;
  verificationMovies: MoviePreview[];
};

const copy = {
  en: {
    eyebrow: "Auckland · Film finder",
    title: "Find films and check Auckland sessions",
    intro: "See what's on at HOYTS and EVENT Cinemas across Auckland, then open a film for every cinema showing it, session times and ticket prices.",
    fallbackTitle: "Find a film, then check a nearby cinema",
    fallbackIntro: "Live sessions are unavailable right now. Search movie previews or open a cinema's official site for today's sessions.",
    distance: "Sort cinemas by my distance",
    locating: "Finding your location…",
    privacy: "Your location stays on this device and is never saved.",
    locationError: "Location is unavailable. You can still browse every cinema.",
    footer: "Free discovery. Booking stays with the cinema.",
  },
  zh: {
    eyebrow: "奥克兰 · 电影检索",
    title: "查找电影并核对奥克兰场次",
    intro: "查看奥克兰 HOYTS 和 EVENT Cinemas 正在放映的电影，点开即可看到哪些影院在放、场次时间和票价。",
    fallbackTitle: "先找电影，再查看附近影院",
    fallbackIntro: "实时场次暂时不可用。可以搜索电影预览，或前往影院官网查看今天的场次。",
    distance: "按离我的距离排列影院",
    locating: "正在获取位置…",
    privacy: "你的位置只在当前设备使用，不会被保存。",
    locationError: "暂时无法获取位置，你仍可浏览全部影院。",
    footer: "免费检索，订票仍在影院官网完成。",
  },
} as const;

function isShowing(value: unknown): value is MovieShowing {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.title === "string"
    && typeof record.cinemaCount === "number" && typeof record.sessionCount === "number"
    && typeof record.nextStartTime === "string" && Number.isFinite(Date.parse(record.nextStartTime))
    && typeof record.nextCinemaName === "string" && Array.isArray(record.screenTypes);
}

function isFeedResponse(value: unknown): value is FeedResponse {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.films) && record.films.every(isShowing)
    && (record.sourceState === "ready" || record.sourceState === "empty" || record.sourceState === "unavailable")
    && Array.isArray(record.unavailableChains)
    && typeof record.checkedAt === "string" && Number.isFinite(Date.parse(record.checkedAt));
}

async function requestScreenings(query: string | null, date: MovieDateFilter, signal: AbortSignal): Promise<FeedResponse> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  params.set("date", date);
  const response = await fetch(`/api/movies?${params.toString()}`, { signal });
  const payload: unknown = await response.json();
  if (!response.ok || !isFeedResponse(payload)) throw new Error("MOVIE_FEED_ERROR");
  return payload;
}

function isMoviePreview(value: unknown): value is MoviePreview {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "number"
    && Number.isSafeInteger(record.id)
    && typeof record.title === "string"
    && (record.posterUrl === null || typeof record.posterUrl === "string");
}

function isMoviePreviewPage(value: unknown): value is MoviePreviewPage {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return Array.isArray(record.movies) && record.movies.every(isMoviePreview)
    && typeof record.page === "object" && record.page !== null;
}

async function requestMoviePreviewPage(
  query: string | null,
  language: "en" | "zh",
  signal: AbortSignal,
): Promise<MoviePreviewPage> {
  const params = new URLSearchParams({ language });
  if (query) params.set("q", query);
  params.set("page", "1");
  const response = await fetch(`/api/movie-previews?${params.toString()}`, { signal });
  const payload: unknown = await response.json();
  if (!response.ok || !isMoviePreviewPage(payload)) throw new Error("MOVIE_PREVIEW_ERROR");
  return payload;
}

async function requestMoviePreviews(
  query: string | null,
  language: "en" | "zh",
  signal: AbortSignal,
): Promise<PreviewResponse> {
  const localizedRequest = requestMoviePreviewPage(query, language, signal);
  if (language === "en") {
    const localized = await localizedRequest;
    return { localized, verificationMovies: localized.movies };
  }
  const [localized, english] = await Promise.all([
    localizedRequest,
    requestMoviePreviewPage(query, "en", signal),
  ]);
  return { localized, verificationMovies: english.movies };
}

function validPosition(position: GeolocationPosition): boolean {
  return Number.isFinite(position.coords.latitude)
    && position.coords.latitude >= -90 && position.coords.latitude <= 90
    && Number.isFinite(position.coords.longitude)
    && position.coords.longitude >= -180 && position.coords.longitude <= 180;
}

export function MoviesPageContent({ initialQuery, initialDate }: {
  initialQuery: string | null;
  initialDate: MovieDateFilter;
}) {
  const { language } = useLanguage();
  const content = copy[language];
  const [query, setQuery] = useState(initialQuery ?? "");
  const [activeQuery, setActiveQuery] = useState(initialQuery);
  const [date, setDate] = useState(initialDate);
  const [films, setFilms] = useState<MovieShowing[]>([]);
  const [unavailableChains, setUnavailableChains] = useState<CinemaChain[]>([]);
  const [feedState, setFeedState] = useState<MovieFeedState>("loading");
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [previewMovies, setPreviewMovies] = useState<MoviePreview[]>([]);
  const [previewVerificationMovies, setPreviewVerificationMovies] = useState<MoviePreview[]>([]);
  const [previewState, setPreviewState] = useState<MoviePreviewState>("loading");
  const [previewAttempt, setPreviewAttempt] = useState(0);
  const [origin, setOrigin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationState, setLocationState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    document.title = language === "zh" ? "奥克兰电影 — KiwiCue" : "Auckland movies — KiwiCue";
  }, [language]);

  useEffect(() => {
    const controller = new AbortController();
    requestScreenings(activeQuery, date, controller.signal).then((payload) => {
      setFilms(payload.films);
      setUnavailableChains(payload.unavailableChains);
      setFeedState(payload.sourceState);
      setCheckedAt(payload.checkedAt);
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) setFeedState("error");
    });
    return () => controller.abort();
  }, [activeQuery, date]);

  useEffect(() => {
    const controller = new AbortController();
    requestMoviePreviews(activeQuery, language, controller.signal).then((payload) => {
      setPreviewMovies(payload.localized.movies);
      setPreviewVerificationMovies(payload.verificationMovies);
      setPreviewState(payload.localized.movies.length > 0 ? "ready" : "empty");
    }).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) setPreviewState("unavailable");
    });
    return () => controller.abort();
  }, [activeQuery, language, previewAttempt]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (activeQuery) params.set("q", activeQuery);
    if (date !== "today") params.set("date", date);
    const suffix = params.size > 0 ? `?${params.toString()}` : "";
    window.history.replaceState(null, "", `/movies${suffix}`);
  }, [activeQuery, date]);

  const cinemas = useMemo(() => {
    const matches = filterCinemas(AUCKLAND_CINEMAS, query);
    const visible = matches.length > 0 || query.trim().length === 0 ? matches : [...AUCKLAND_CINEMAS];
    return origin ? sortCinemasByDistance(visible, origin) : visible;
  }, [origin, query]);
  const verifiedMovieIds = useMemo(
    () => new Set(filterShowingMoviePreviews(previewVerificationMovies, films).map(({ id }) => id)),
    [previewVerificationMovies, films],
  );
  const movieIds = useMemo(() => {
    const ids = new Map<string, number>();
    for (const movie of [...previewVerificationMovies, ...previewMovies]) {
      for (const title of [movie.title, movie.originalTitle]) if (title) ids.set(normalizedMovieTitle(title), movie.id);
    }
    return ids;
  }, [previewMovies, previewVerificationMovies]);
  const sessionState = feedState === "error" ? "unavailable" : feedState;
  const showLiveFeed = feedState === "loading" || feedState === "ready" || feedState === "empty";
  const cinemaAccess = (
    <>
      <aside className="cinema-tools" aria-label={content.distance}>
        <button type="button" onClick={locate} disabled={locationState === "loading"}>
          {locationState === "loading" ? content.locating : content.distance}
        </button>
        <p>{content.privacy}</p>
        {locationState === "error" ? <p role="alert">{content.locationError}</p> : null}
      </aside>
      <CinemaDirectory cinemas={cinemas} language={language} />
    </>
  );

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = parseMovieQuery(query);
    if (nextQuery === activeQuery) return;
    setFeedState("loading");
    setPreviewState("loading");
    setActiveQuery(nextQuery);
  }

  function findFilm(title: string) {
    const nextQuery = parseMovieQuery(title);
    setQuery(title);
    if (nextQuery === activeQuery) return;
    setFeedState("loading");
    setPreviewState("loading");
    setActiveQuery(nextQuery);
    document.getElementById("movie-previews")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  function clearSearch() {
    setQuery("");
    if (activeQuery === null) return;
    setFeedState("loading");
    setPreviewState("loading");
    setActiveQuery(null);
  }

  function changeDate(nextDate: MovieDateFilter) {
    if (nextDate === date) return;
    setFeedState("loading");
    setDate(nextDate);
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setLocationState("error");
      return;
    }
    setLocationState("loading");
    navigator.geolocation.getCurrentPosition((position) => {
      if (!validPosition(position)) {
        setLocationState("error");
        return;
      }
      setOrigin({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setLocationState("ready");
    }, () => setLocationState("error"), { enableHighAccuracy: false, timeout: 8_000, maximumAge: 600_000 });
  }

  return (
    <main className="movies-page">
      <PortalHeader currentPage="movies" skipTarget={showLiveFeed ? "movie-results" : "cinema-directory"} />
      <section className="movies-command" aria-labelledby="movies-title">
        <p className="eyebrow">{content.eyebrow}</p>
        <h1 className="editorial-display" id="movies-title">{showLiveFeed ? content.title : content.fallbackTitle}</h1>
        <p className="movies-intro">{showLiveFeed ? content.intro : content.fallbackIntro}</p>
        <MovieSearchPanel
          language={language} query={query} date={date} loading={feedState === "loading" || previewState === "loading"}
          showDateFilters={showLiveFeed}
          onQueryChange={setQuery} onSubmit={submitSearch} onClear={clearSearch} onDateChange={changeDate}
        />
      </section>
      <div className="movies-layout">
        {showLiveFeed ? (
          <MovieScreeningFeed
            films={films} state={feedState} language={language} checkedAt={checkedAt}
            unavailableChains={unavailableChains} movieIds={movieIds} onFind={findFilm}
          />
        ) : cinemaAccess}
        <MoviePreviewGrid
          movies={previewMovies}
          state={previewState}
          sessionState={sessionState}
          verifiedMovieIds={verifiedMovieIds}
          language={language}
          query={activeQuery}
          onReset={clearSearch}
          onRetry={() => {
            setPreviewState("loading");
            setPreviewAttempt((value) => value + 1);
          }}
        />
        {showLiveFeed ? cinemaAccess : null}
      </div>
      <footer className="portal-footer"><span>KiwiCue / 纽村小报</span><span>{content.footer}</span></footer>
    </main>
  );
}
