"use client";

import { useState } from "react";
import type { KiwiCueScreening } from "../lib/movies";
import { isTrustedOfficialBookingUrl } from "../lib/official-booking";
import type { MovieSessionStatus } from "../lib/movie-previews";
import type { Language } from "./language-provider";

const copy = {
  en: {
    title: "Source-matched Auckland sessions", cinema: "Cinema", date: "Date", all: "All",
    confirmed: "Source title and runtime matched. Confirm final availability on the cinema's official site.",
    checked: (value: string) => `Checked ${value}; confirm with the cinema.`,
    book: "Book on official site", soldOut: "Sold out", unavailable: "Official booking link unavailable",
    empty: "No source-title matches found", emptyHelp: "This does not confirm that the film is not showing. Check the general cinema directory below.",
    filteredEmpty: "No sessions match these filters", clear: "Clear session filters",
    notCovered: "Auckland live-data coverage is not available. This does not mean the film is not showing.",
    failed: "Session matching is temporarily unavailable", failedHelp: "Use the general cinema directory below to check official sites.",
  },
  zh: {
    title: "来源标题匹配的奥克兰场次", cinema: "影院", date: "日期", all: "全部",
    confirmed: "已匹配来源片名和片长；最终余票与时间请以影院官网为准。",
    checked: (value: string) => `检查时间：${value}；请向影院确认。`,
    book: "前往官网订票", soldOut: "已售罄", unavailable: "暂未提供官方订票链接",
    empty: "未找到来源标题匹配的场次", emptyHelp: "这不代表电影没有上映，请在下方通用影院目录查看官网。",
    filteredEmpty: "没有符合这些筛选条件的场次", clear: "清除场次筛选",
    notCovered: "奥克兰实时数据暂未覆盖；这不代表电影没有上映。",
    failed: "暂时无法匹配场次", failedHelp: "请使用下方通用影院目录查看各影院官网。",
  },
} as const;

function dateKey(value: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function formatTime(value: string, language: Language): string {
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-NZ", { timeZone: "Pacific/Auckland", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function SessionAction({ session, language }: { session: KiwiCueScreening; language: Language }) {
  const content = copy[language];
  if (session.soldOut) return <strong>{content.soldOut}</strong>;
  if (!isTrustedOfficialBookingUrl(session.bookingUrl)) return <span>{content.unavailable}</span>;
  return <a href={session.bookingUrl} target="_blank" rel="noreferrer noopener">{content.book}<span aria-hidden="true"> ↗</span></a>;
}

function SessionList({ sessions, language }: { sessions: KiwiCueScreening[]; language: Language }) {
  return <ol className="movie-detail-session-list">{sessions.map((session) => <li key={session.id}>
    <time dateTime={session.startTime}>{formatTime(session.startTime, language)}</time>
    <div><strong>{session.cinemaName}</strong><span>{session.formats.join(" · ")}</span></div>
    <SessionAction session={session} language={language} />
  </li>)}</ol>;
}

function FilteredEmpty({ language, onClear }: { language: Language; onClear: () => void }) {
  const content = copy[language];
  return <div className="movie-detail-sessions-empty" role="status">
    <strong>{content.filteredEmpty}</strong><button type="button" onClick={onClear}>{content.clear}</button>
  </div>;
}

export function MovieDetailSessions({ screenings, sessionStatus, checkedAt, language }: {
  screenings: KiwiCueScreening[]; sessionStatus: MovieSessionStatus; checkedAt: string | null; language: Language;
}) {
  const content = copy[language];
  const [cinema, setCinema] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const cinemas = [...new Set(screenings.map((session) => session.cinemaName))];
  const dates = [...new Set(screenings.map((session) => dateKey(session.startTime)))];
  const visible = screenings.filter((session) => (!cinema || session.cinemaName === cinema) && (!date || dateKey(session.startTime) === date));
  const message = sessionStatus === "not-covered" ? content.notCovered : sessionStatus === "unavailable" ? content.failed : content.empty;
  return <section className="movie-detail-sessions" aria-labelledby="movie-detail-sessions-title">
    <h2 id="movie-detail-sessions-title">{content.title}</h2>
    {sessionStatus === "verified" ? <><p>{content.confirmed}</p>{checkedAt ? <p className="movie-detail-sessions-checked">{content.checked(checkedAt)}</p> : null}
      {cinemas.length > 1 || dates.length > 1 ? <div className="movie-detail-session-filters">
        {cinemas.length > 1 ? <label>{content.cinema}<select value={cinema} onChange={(event) => setCinema(event.target.value)}><option value="">{content.all}</option>{cinemas.map((value) => <option key={value}>{value}</option>)}</select></label> : null}
        {dates.length > 1 ? <label>{content.date}<select value={date} onChange={(event) => setDate(event.target.value)}><option value="">{content.all}</option>{dates.map((value) => <option key={value} value={value}>{value}</option>)}</select></label> : null}
      </div> : null}{visible.length > 0 ? <SessionList sessions={visible} language={language} /> : <FilteredEmpty language={language} onClear={() => { setCinema(""); setDate(""); }} />}</> : <div role="status"><strong>{message}</strong><p>{sessionStatus === "unverified" ? content.emptyHelp : sessionStatus === "unavailable" ? content.failedHelp : null}</p></div>}
  </section>;
}
