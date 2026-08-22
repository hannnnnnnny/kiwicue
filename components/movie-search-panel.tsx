"use client";

import type { FormEvent } from "react";
import type { MovieDateFilter } from "../lib/movies";
import type { Language } from "./language-provider";

const copy = {
  en: {
    label: "Movie, cinema, or suburb",
    placeholder: "Try a film, Academy, or Newmarket",
    search: "Search movies",
    clear: "Clear search",
    form: "Find a movie or cinema",
    dates: "Choose a date",
    options: { today: "Today", tomorrow: "Tomorrow", weekend: "This weekend", all: "All upcoming" },
  },
  zh: {
    label: "电影、影院或区域",
    placeholder: "例如：电影名、Academy 或 Newmarket",
    search: "搜索电影",
    clear: "清除搜索",
    form: "查找电影或影院",
    dates: "选择日期",
    options: { today: "今天", tomorrow: "明天", weekend: "本周末", all: "全部未来场次" },
  },
} as const;

const DATE_FILTERS: MovieDateFilter[] = ["today", "tomorrow", "weekend", "all"];

export function MovieSearchPanel(props: {
  language: Language;
  query: string;
  date: MovieDateFilter;
  loading: boolean;
  showDateFilters?: boolean;
  onQueryChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClear: () => void;
  onDateChange: (value: MovieDateFilter) => void;
}) {
  const content = copy[props.language];
  return (
    <section className="movie-search-panel" aria-label={content.form}>
      <form role="search" aria-label={content.form} onSubmit={props.onSubmit}>
        <div className="movie-search-field">
          <label htmlFor="movie-query">{content.label}</label>
          <input
            id="movie-query"
            name="q"
            type="search"
            value={props.query}
            maxLength={100}
            autoComplete="off"
            placeholder={content.placeholder}
            onChange={(event) => props.onQueryChange(event.target.value)}
          />
        </div>
        <button className="movie-search-submit" type="submit" disabled={props.loading}>
          {content.search}
        </button>
        <button className="movie-search-clear" type="button" onClick={props.onClear} disabled={!props.query}>
          {content.clear}
        </button>
      </form>
      {props.showDateFilters !== false ? <fieldset className="movie-date-filter">
        <legend>{content.dates}</legend>
        <div>
          {DATE_FILTERS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={props.date === value}
              onClick={() => props.onDateChange(value)}
            >
              {content.options[value]}
            </button>
          ))}
        </div>
      </fieldset> : null}
    </section>
  );
}
