"use client";

import Link from "next/link";
import { useState } from "react";
import type { CinemaChain, MovieShowing } from "../lib/movies";
import type { Language } from "./language-provider";

const INITIAL_FILMS = 12;

export type MovieFeedState = "loading" | "ready" | "empty" | "unavailable" | "error";

const copy = {
  en: {
    title: "Now showing in Auckland",
    source: "Live from HOYTS and EVENT Cinemas",
    checked: (value: string) => `Updated ${value}`,
    loading: "Loading Auckland sessions",
    empty: "No sessions found for this date",
    emptyHelp: "Try another date, or check the independent cinemas below.",
    unavailable: "Live sessions are temporarily unavailable",
    unavailableHelp: "The cinema sites could not be reached. Their official links below still work.",
    error: "Movie sessions could not be loaded",
    errorHelp: "Check your connection or use an official cinema link below.",
    partial: (chains: string) => `${chains} sessions are temporarily unavailable, so the list may be incomplete.`,
    minutes: (minutes: number) => `${minutes} min`,
    reach: (cinemas: number, sessions: number) => `${cinemas} ${cinemas === 1 ? "cinema" : "cinemas"} · ${sessions} ${sessions === 1 ? "session" : "sessions"}`,
    next: (time: string, cinema: string) => `Next: ${time} · ${cinema}`,
    open: "Cinemas, times & prices",
    find: "Find this film",
    more: (count: number) => `Show all ${count} films`,
  },
  zh: {
    title: "奥克兰正在上映",
    source: "实时数据来自 HOYTS 和 EVENT Cinemas",
    checked: (value: string) => `更新于 ${value}`,
    loading: "正在加载奥克兰场次",
    empty: "这个日期暂无场次",
    emptyHelp: "换个日期试试，或查看下方独立影院的官网。",
    unavailable: "实时场次暂时不可用",
    unavailableHelp: "暂时无法连接影院网站，下方影院官网入口仍可使用。",
    error: "电影场次加载失败",
    errorHelp: "请检查网络，或使用下方影院官网入口。",
    partial: (chains: string) => `${chains} 的场次暂时无法获取，列表可能不完整。`,
    minutes: (minutes: number) => `${minutes} 分钟`,
    reach: (cinemas: number, sessions: number) => `${cinemas} 家影院 · ${sessions} 场`,
    next: (time: string, cinema: string) => `最近一场：${time} · ${cinema}`,
    open: "影院、场次和票价",
    find: "查找这部电影",
    more: (count: number) => `显示全部 ${count} 部电影`,
  },
} as const;

function formatTime(value: string, language: Language, withDay: boolean): string {
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-NZ", {
    timeZone: "Pacific/Auckland", ...(withDay ? { weekday: "short", day: "numeric", month: "short" } : {}),
    hour: "numeric", minute: "2-digit",
  }).format(new Date(value));
}

function MovieFeedMessage({ state, language }: { state: Exclude<MovieFeedState, "ready">; language: Language }) {
  const content = copy[language];
  if (state === "loading") {
    return (
      <div className="movie-session-skeletons" aria-label={content.loading} aria-live="polite">
        {[0, 1, 2].map((item) => <div className="movie-session-skeleton" key={item}><span /><span /><span /></div>)}
      </div>
    );
  }
  const title = state === "empty" ? content.empty : state === "unavailable" ? content.unavailable : content.error;
  const help = state === "empty" ? content.emptyHelp : state === "unavailable" ? content.unavailableHelp : content.errorHelp;
  return <div className="movie-feed-message" role={state === "error" ? "alert" : "status"}><strong>{title}</strong><p>{help}</p></div>;
}

function ShowingCard({ film, language, movieId, onFind }: {
  film: MovieShowing; language: Language; movieId: number | undefined; onFind: (title: string) => void;
}) {
  const content = copy[language];
  const details = [film.rating, film.runtimeMinutes === null ? null : content.minutes(film.runtimeMinutes)].filter(Boolean).join(" · ");
  const premium = film.screenTypes.filter((type) => type !== "Standard");
  return (
    <li className="movie-session-card">
      <div className="movie-session-main">
        <h3>{film.title}</h3>
        {details ? <p className="movie-session-details">{details}</p> : null}
        <p className="movie-session-cinema">{content.reach(film.cinemaCount, film.sessionCount)}</p>
        <p className="movie-session-details">{content.next(formatTime(film.nextStartTime, language, true), film.nextCinemaName)}</p>
        {premium.length > 0 ? <div className="movie-session-formats">{premium.map((type) => <span key={type}>{type}</span>)}</div> : null}
      </div>
      <div className="movie-session-action">
        {movieId === undefined
          ? <button type="button" onClick={() => onFind(film.title)}>{content.find}</button>
          : <Link href={`/movies/${movieId}`}>{content.open}<span aria-hidden="true"> →</span></Link>}
      </div>
    </li>
  );
}

export function MovieScreeningFeed({ films, state, language, checkedAt, unavailableChains, movieIds, onFind }: {
  films: MovieShowing[];
  state: MovieFeedState;
  language: Language;
  checkedAt: string | null;
  unavailableChains: CinemaChain[];
  movieIds: ReadonlyMap<string, number>;
  onFind: (title: string) => void;
}) {
  const content = copy[language];
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? films : films.slice(0, INITIAL_FILMS);
  return (
    <section className="movie-feed" id="movie-results" aria-labelledby="movie-feed-title">
      <header>
        <div>
          <p className="eyebrow">{content.source}</p>
          <h2 id="movie-feed-title">{content.title}</h2>
          {checkedAt ? <p className="movie-feed-checked">{content.checked(formatTime(checkedAt, language, false))}</p> : null}
        </div>
        <span>{films.length}</span>
      </header>
      {state === "ready" && unavailableChains.length > 0
        ? <p className="movie-feed-partial" role="status">{content.partial(unavailableChains.join(" / "))}</p> : null}
      {state === "ready"
        ? <ol className="movie-session-list">{visible.map((film) => <ShowingCard key={film.id} film={film} language={language} movieId={movieIds.get(film.id)} onFind={onFind} />)}</ol>
        : <MovieFeedMessage state={state} language={language} />}
      {state === "ready" && visible.length < films.length
        ? <button type="button" className="movie-feed-more" onClick={() => setExpanded(true)}>{content.more(films.length)}</button> : null}
    </section>
  );
}
