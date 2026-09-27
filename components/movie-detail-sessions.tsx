"use client";

import { useState } from "react";
import type { CinemaChain, KiwiCueScreening } from "../lib/movies";
import { isTrustedOfficialBookingUrl } from "../lib/official-booking";
import type { MovieSessionStatus } from "../lib/movie-previews";
import type { Language } from "./language-provider";

const copy = {
  en: {
    title: "Where to watch in Auckland",
    summary: (cinemas: number, sessions: number) => `${cinemas} ${cinemas === 1 ? "cinema" : "cinemas"} · ${sessions} ${sessions === 1 ? "session" : "sessions"} this week`,
    checked: (value: string) => `Updated ${value}`,
    dates: "Choose a date", today: "Today", tomorrow: "Tomorrow",
    livePrice: (range: string) => `${range} per ticket`,
    fee: (range: string) => `+ ${range} booking fee`,
    atBooking: "Price shown when you book",
    tuesday: "Half-price adult tickets on Tuesdays for Cinebuzz members",
    halfPrice: "Half price", soldOut: "Sold out",
    book: (time: string, cinema: string) => `Book ${time} at ${cinema} on the official site`,
    note: "Tap a time to book on the cinema's official site. HOYTS prices are live from HOYTS for public tickets (adult, child, senior, student, premium seats) and exclude member-only offers. EVENT Cinemas shows its prices during booking.",
    partial: (chains: string) => `${chains} sessions could not be checked right now, so other cinemas may also be showing this film.`,
    empty: "Not showing at HOYTS or EVENT Cinemas this week",
    emptyHelp: "It may still be on at an independent cinema. Check the cinema list below.",
    failed: "Live sessions are temporarily unavailable",
    failedHelp: "Use the official cinema sites below to check sessions.",
  },
  zh: {
    title: "在奥克兰哪里看",
    summary: (cinemas: number, sessions: number) => `本周 ${cinemas} 家影院 · ${sessions} 场`,
    checked: (value: string) => `更新于 ${value}`,
    dates: "选择日期", today: "今天", tomorrow: "明天",
    livePrice: (range: string) => `每张 ${range}`,
    fee: (range: string) => `另加订票手续费 ${range}`,
    atBooking: "票价在订票时显示",
    tuesday: "Cinebuzz 会员每周二成人票半价",
    halfPrice: "半价", soldOut: "已售罄",
    book: (time: string, cinema: string) => `前往官网预订 ${cinema} ${time} 场次`,
    note: "点击场次时间即可前往影院官网订票。HOYTS 票价实时来自 HOYTS，包含成人、儿童、长者、学生及高级座位等公开票种，不含会员专享优惠；EVENT Cinemas 的票价在订票流程中显示。",
    partial: (chains: string) => `${chains} 的场次暂时无法核对，其他影院也可能在放映这部电影。`,
    empty: "本周 HOYTS 和 EVENT Cinemas 暂无场次",
    emptyHelp: "独立影院可能仍在放映，请查看下方影院列表。",
    failed: "实时场次暂时不可用",
    failedHelp: "请使用下方影院官网查看场次。",
  },
} as const;

type CinemaGroup = { id: string; name: string; chain: CinemaChain; sessions: KiwiCueScreening[] };

function locale(language: Language): string {
  return language === "zh" ? "zh-CN" : "en-NZ";
}

function dateKey(value: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Pacific/Auckland", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
}

function dateLabel(key: string, language: Language): string {
  const today = dateKey(new Date());
  const tomorrow = dateKey(new Date(Date.now() + 86_400_000));
  if (key === today) return copy[language].today;
  if (key === tomorrow) return copy[language].tomorrow;
  return new Intl.DateTimeFormat(locale(language), { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${key}T12:00:00Z`));
}

function formatTime(value: string, language: Language): string {
  return new Intl.DateTimeFormat(locale(language), { timeZone: "Pacific/Auckland", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function range(values: number[]): string | null {
  if (values.length === 0) return null;
  const [low, high] = [Math.min(...values), Math.max(...values)];
  return low === high ? dollars(low) : `${dollars(low)} – ${dollars(high)}`;
}

function groupByCinema(sessions: KiwiCueScreening[]): CinemaGroup[] {
  const groups = new Map<string, CinemaGroup>();
  for (const session of sessions) {
    const group = groups.get(session.cinemaId) ?? { id: session.cinemaId, name: session.cinemaName, chain: session.chain, sessions: [] };
    group.sessions.push(session);
    groups.set(session.cinemaId, group);
  }
  return [...groups.values()];
}

function CinemaPrice({ sessions, chain, language }: { sessions: KiwiCueScreening[]; chain: CinemaChain; language: Language }) {
  const content = copy[language];
  const priced = sessions.flatMap((session) => session.price ? [session.price] : []);
  const tickets = range(priced.flatMap((price) => [price.minCents, price.maxCents]));
  const fees = range(priced.flatMap((price) => price.bookingFeeCents === null ? [] : [price.bookingFeeCents]));
  return <p className="cinema-showtimes-price">
    {tickets ? <strong>{content.livePrice(tickets)}</strong> : <strong>{content.atBooking}</strong>}
    {tickets && fees ? <span>{content.fee(fees)}</span> : null}
    {chain === "EVENT Cinemas" ? <span>{content.tuesday}</span> : null}
  </p>;
}

function SessionTime({ session, cinemaName, language }: { session: KiwiCueScreening; cinemaName: string; language: Language }) {
  const content = copy[language];
  const time = formatTime(session.startTime, language);
  const tags = [session.screenType === "Standard" ? null : session.screenType, session.discounted ? content.halfPrice : null, ...session.formats]
    .filter((tag): tag is string => Boolean(tag));
  const body = <><time dateTime={session.startTime}>{time}</time>{tags.map((tag) => <small key={tag}>{tag}</small>)}</>;
  if (session.soldOut || !isTrustedOfficialBookingUrl(session.bookingUrl)) {
    return <li><span className="cinema-showtime" data-disabled="true">{body}{session.soldOut ? <small>{content.soldOut}</small> : null}</span></li>;
  }
  return <li><a className="cinema-showtime" href={session.bookingUrl} target="_blank" rel="noreferrer noopener" aria-label={content.book(time, cinemaName)}>{body}</a></li>;
}

function CinemaCard({ group, allSessions, language }: { group: CinemaGroup; allSessions: KiwiCueScreening[]; language: Language }) {
  return <li className="cinema-showtimes-card">
    <header><h3>{group.name}</h3><span data-chain={group.chain === "HOYTS" ? "hoyts" : "event"}>{group.chain}</span></header>
    <CinemaPrice sessions={allSessions.filter((session) => session.cinemaId === group.id)} chain={group.chain} language={language} />
    <ul className="cinema-showtime-list">{group.sessions.map((session) => <SessionTime key={session.id} session={session} cinemaName={group.name} language={language} />)}</ul>
  </li>;
}

function Showtimes({ screenings, checkedAt, unavailableChains, language }: {
  screenings: KiwiCueScreening[]; checkedAt: string | null; unavailableChains: CinemaChain[]; language: Language;
}) {
  const content = copy[language];
  const dates = [...new Set(screenings.map((session) => dateKey(session.startTime)))];
  const [selected, setSelected] = useState(dates[0]);
  const active = dates.includes(selected) ? selected : dates[0];
  const groups = groupByCinema(screenings.filter((session) => dateKey(session.startTime) === active));
  return <>
    <p className="movie-detail-sessions-checked">
      {content.summary(new Set(screenings.map((session) => session.cinemaId)).size, screenings.length)}
      {checkedAt ? ` · ${content.checked(formatTime(checkedAt, language))}` : null}
    </p>
    {unavailableChains.length > 0 ? <p role="status">{content.partial(unavailableChains.join(" / "))}</p> : null}
    <div className="cinema-date-tabs" role="group" aria-label={content.dates}>
      {dates.map((key) => <button key={key} type="button" aria-pressed={key === active} onClick={() => setSelected(key)}>{dateLabel(key, language)}</button>)}
    </div>
    <ol className="cinema-showtimes">{groups.map((group) => <CinemaCard key={group.id} group={group} allSessions={screenings} language={language} />)}</ol>
    <p className="cinema-showtimes-note">{content.note}</p>
  </>;
}

export function MovieDetailSessions({ screenings, sessionStatus, checkedAt, unavailableChains = [], language }: {
  screenings: KiwiCueScreening[]; sessionStatus: MovieSessionStatus; checkedAt: string | null;
  unavailableChains?: CinemaChain[]; language: Language;
}) {
  const content = copy[language];
  const showing = sessionStatus === "verified" && screenings.length > 0;
  return <section className="movie-detail-sessions" aria-labelledby="movie-detail-sessions-title">
    <h2 id="movie-detail-sessions-title">{content.title}</h2>
    {showing
      ? <Showtimes screenings={screenings} checkedAt={checkedAt} unavailableChains={unavailableChains} language={language} />
      : <div role="status">
        <strong>{sessionStatus === "unavailable" ? content.failed : content.empty}</strong>
        <p>{sessionStatus === "unavailable" ? content.failedHelp : content.emptyHelp}</p>
        {sessionStatus !== "unavailable" && unavailableChains.length > 0 ? <p>{content.partial(unavailableChains.join(" / "))}</p> : null}
      </div>}
  </section>;
}
