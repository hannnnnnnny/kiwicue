import type { KiwiCueScreening } from "../lib/movies";
import type { Language } from "./language-provider";

export type MovieFeedState = "loading" | "ready" | "empty" | "not-covered" | "unavailable" | "error";

const copy = {
  en: {
    title: "Live movie sessions",
    source: "Open Cinema public feed",
    checked: (value: string) => `Coverage checked ${value}`,
    loading: "Loading movie sessions",
    empty: "No open-feed sessions found",
    emptyHelp: "Try another date or use the official cinema links below.",
    notCovered: "Auckland live-data coverage is not available yet",
    notCoveredHelp: "The authorized provider currently lists no Auckland cinemas. This is not evidence that no films are showing; use the official cinema links below.",
    unavailable: "Live sessions are temporarily unavailable",
    unavailableHelp: "The cinema directory and official session links still work.",
    error: "Movie sessions could not be loaded",
    errorHelp: "Check your connection or use an official cinema link below.",
    book: "Book on official site",
    official: "Open official listing",
    soldOut: "Sold out",
    away: (distance: number) => `${distance.toFixed(1)} km away`,
    minutes: (minutes: number) => `${minutes} min`,
  },
  zh: {
    title: "实时电影场次",
    source: "Open Cinema 公共数据源",
    checked: (value: string) => `覆盖状态核对时间：${value}`,
    loading: "正在加载电影场次",
    empty: "暂未找到开放数据场次",
    emptyHelp: "可以换个日期，或直接使用下方影院官网入口。",
    notCovered: "奥克兰实时数据暂未覆盖",
    notCoveredHelp: "授权数据源目前没有收录奥克兰影院；这不代表没有电影上映，请使用下方影院官网核实。",
    unavailable: "实时场次暂时不可用",
    unavailableHelp: "影院目录和官方场次链接仍可正常使用。",
    error: "电影场次加载失败",
    errorHelp: "请检查网络，或使用下方影院官网入口。",
    book: "前往官网订票",
    official: "打开官方场次页面",
    soldOut: "已售罄",
    away: (distance: number) => `距离约 ${distance.toFixed(1)} 公里`,
    minutes: (minutes: number) => `${minutes} 分钟`,
  },
} as const;

function formatScreeningTime(value: string, language: Language): string {
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-NZ", {
    timeZone: "Pacific/Auckland",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCheckedTime(value: string, language: Language): string {
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en-NZ", {
    timeZone: "Pacific/Auckland",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
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
  const title = state === "empty" ? content.empty
    : state === "not-covered" ? content.notCovered
      : state === "unavailable" ? content.unavailable : content.error;
  const help = state === "empty" ? content.emptyHelp
    : state === "not-covered" ? content.notCoveredHelp
      : state === "unavailable" ? content.unavailableHelp : content.errorHelp;
  return <div className="movie-feed-message" role={state === "error" ? "alert" : "status"}><strong>{title}</strong><p>{help}</p></div>;
}

function ScreeningCard({ screening, language }: { screening: KiwiCueScreening; language: Language }) {
  const content = copy[language];
  const details = [screening.filmRating, screening.runtimeMinutes === null ? null : content.minutes(screening.runtimeMinutes)]
    .filter(Boolean).join(" · ");
  return (
    <li className="movie-session-card">
      <div className="movie-session-time"><time dateTime={screening.startTime}>{formatScreeningTime(screening.startTime, language)}</time></div>
      <div className="movie-session-main">
        <h3>{screening.filmTitle}</h3>
        <p className="movie-session-cinema">{screening.cinemaName}</p>
        {details ? <p className="movie-session-details">{details}</p> : null}
        <div className="movie-session-formats">{screening.formats.map((format) => <span key={format}>{format}</span>)}</div>
      </div>
      <div className="movie-session-action">
        {screening.distanceKilometres === null ? null : <span>{content.away(screening.distanceKilometres)}</span>}
        {screening.soldOut ? <strong>{content.soldOut}</strong> : screening.bookingUrl ? (
          <a href={screening.bookingUrl} target="_blank" rel="noreferrer noopener">{content.book}<span aria-hidden="true"> ↗</span></a>
        ) : <span>{content.official}</span>}
      </div>
    </li>
  );
}

export function MovieScreeningFeed({ screenings, state, language, checkedAt }: {
  screenings: KiwiCueScreening[];
  state: MovieFeedState;
  language: Language;
  checkedAt: string | null;
}) {
  const content = copy[language];
  return (
    <section className="movie-feed" id="movie-results" aria-labelledby="movie-feed-title">
      <header>
        <div>
          <p className="eyebrow">{content.source}</p>
          <h2 id="movie-feed-title">{content.title}</h2>
          {checkedAt ? <p className="movie-feed-checked">{content.checked(formatCheckedTime(checkedAt, language))}</p> : null}
        </div>
        <span>{screenings.length}</span>
      </header>
      {state === "ready" ? <ol className="movie-session-list">{screenings.map((screening) => <ScreeningCard key={screening.id} screening={screening} language={language} />)}</ol> : <MovieFeedMessage state={state} language={language} />}
    </section>
  );
}
