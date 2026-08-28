"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import type { EventCategory } from "../lib/event-categories";
import { parseEventKeyword, parseVenueId, type EventSort } from "../lib/event-search-params";
import { eventSearchHref } from "../lib/event-search-url";
import type { EventWindow } from "../lib/event-window";
import { EventNameCombobox } from "./event-name-combobox";
import { useLanguage } from "./language-provider";

type VenueOption = {
  id: string;
  name: string;
};

type VenueStatus = "loading" | "ready" | "unavailable";

type EventSearchPanelProps = {
  window: EventWindow;
  category: EventCategory | null;
  keyword: string | null;
  venueId: string | null;
  sort?: EventSort;
};

const copy = {
  en: {
    formLabel: "Search Auckland events",
    activityLabel: "Activity name",
    activityPlaceholder: "Artist, concert, market…",
    activityHelper: "Type part of an event or artist name, for example lauf",
    suggestionLoading: "Finding matching events…",
    suggestionEmpty: "No matching event names yet. You can still search this text.",
    suggestionUnavailable: "Suggestions are temporarily unavailable. You can still search.",
    venueLabel: "Venue",
    allVenues: "All venues",
    search: "Search events",
    searching: "Searching events",
    clear: "Clear filters",
    venueUnavailable: "Venue temporarily unavailable",
  },
  zh: {
    formLabel: "搜索奥克兰活动",
    activityLabel: "活动名称",
    activityPlaceholder: "艺人、演出或市集…",
    activityHelper: "输入活动或艺人名称的一部分，例如 lauf",
    suggestionLoading: "正在查找匹配活动…",
    suggestionEmpty: "暂时没有匹配名称，仍可直接搜索。",
    suggestionUnavailable: "联想暂时不可用，仍可直接搜索。",
    venueLabel: "场馆",
    allVenues: "所有场馆",
    search: "搜索活动",
    searching: "正在搜索活动",
    clear: "清除筛选",
    venueUnavailable: "场馆暂时不可用",
  },
} as const;

function parseVenueResponse(value: unknown): VenueOption[] | null {
  if (
    typeof value !== "object"
    || value === null
    || !("venues" in value)
    || !Array.isArray(value.venues)
  ) {
    return null;
  }

  const venues: VenueOption[] = [];
  for (const venue of value.venues) {
    if (
      typeof venue !== "object"
      || venue === null
      || !("id" in venue)
      || !("name" in venue)
      || typeof venue.id !== "string"
      || typeof venue.name !== "string"
    ) {
      return null;
    }

    const id = parseVenueId(venue.id);
    const name = venue.name.trim();
    if (!id || id !== venue.id || !name) return null;
    venues.push({ id, name });
  }

  return venues.sort((left, right) => left.name.localeCompare(right.name));
}

export function EventSearchPanel({
  window: eventWindow = "all",
  category,
  keyword,
  venueId,
  sort = "recommended",
}: EventSearchPanelProps) {
  const { language } = useLanguage();
  const content = copy[language];
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [venueStatus, setVenueStatus] = useState<VenueStatus>("loading");

  useEffect(() => {
    let cancelled = false;

    fetch("/api/venues", { headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Venue catalogue unavailable");
        const parsed = parseVenueResponse(await response.json());
        if (!parsed) throw new Error("Venue catalogue unavailable");
        if (!cancelled) {
          setVenues(parsed);
          setVenueStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVenues([]);
          setVenueStatus("unavailable");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SearchForm
      key={JSON.stringify([eventWindow, category, keyword, venueId, sort])}
      window={eventWindow}
      category={category}
      keyword={keyword}
      venueId={venueId}
      sort={sort}
      venues={venues}
      venueStatus={venueStatus}
      content={content}
    />
  );
}

function SearchForm({
  window: eventWindow,
  category,
  keyword,
  venueId,
  sort = "recommended",
  venues,
  venueStatus,
  content,
}: EventSearchPanelProps & {
  venues: VenueOption[];
  venueStatus: VenueStatus;
  content: typeof copy.en | typeof copy.zh;
}) {
  const router = useRouter();
  const [draftKeyword, setDraftKeyword] = useState(keyword ?? "");
  const [draftVenue, setDraftVenue] = useState(venueId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [submittedHref, setSubmittedHref] = useState<string | null>(null);
  const appliedHref = eventSearchHref({ window: eventWindow, category, keyword, venueId, sort });

  useEffect(() => {
    if (!submitting || submittedHref !== appliedHref) return;
    const timeout = window.setTimeout(() => {
      setSubmitting(false);
      setSubmittedHref(null);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [appliedHref, submittedHref, submitting]);

  function startSearch(keywordValue: string): void {
    if (submitting) return;
    const normalizedKeyword = parseEventKeyword(keywordValue);
    const normalizedVenue = parseVenueId(draftVenue);
    const href = eventSearchHref({
      window: eventWindow,
      category,
      keyword: normalizedKeyword,
      venueId: normalizedVenue,
      sort,
    });
    setSubmitting(true);
    setSubmittedHref(href);
    sessionStorage.setItem("kiwicue:focus-results", "1");
    router.push(href);
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startSearch(draftKeyword);
  }

  return (
    <section className="event-search-panel">
      <form
        className="event-search-form"
        role="search"
        aria-label={content.formLabel}
        onSubmit={submitSearch}
      >
        <div className="event-search-fields">
          <div className="event-search-field event-search-field-name">
            <label htmlFor="event-search-name">{content.activityLabel}</label>
            <EventNameCombobox
              value={draftKeyword}
              onChange={setDraftKeyword}
              onSelect={startSearch}
              window={eventWindow}
              category={category}
              venueId={draftVenue}
              placeholder={content.activityPlaceholder}
              helperId="event-search-name-helper"
              language={content === copy.zh ? "zh" : "en"}
              copy={{
                loading: content.suggestionLoading,
                empty: content.suggestionEmpty,
                unavailable: content.suggestionUnavailable,
              }}
            />
            <p id="event-search-name-helper" className="event-search-helper">
              {content.activityHelper}
            </p>
          </div>

          <div className="event-search-field event-search-field-venue">
            <label htmlFor="event-search-venue">{content.venueLabel}</label>
            <select
              className="event-search-select"
              id="event-search-venue"
              name="venue"
              value={draftVenue}
              disabled={venueStatus === "unavailable"}
              onChange={(event) => setDraftVenue(event.target.value)}
            >
              <option value="">{content.allVenues}</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>{venue.name}</option>
              ))}
            </select>
            {venueStatus === "unavailable" && (
              <p className="event-search-venue-status" role="status">
                {content.venueUnavailable}
              </p>
            )}
          </div>
        </div>

        <div className="event-search-actions">
          <button className="event-search-submit" type="submit" disabled={submitting}>
            {submitting ? content.searching : content.search}
          </button>
          {(keyword || venueId) && (
            <Link className="event-search-clear" href={eventSearchHref({
              window: eventWindow,
              category,
              keyword: null,
              venueId: null,
              sort,
            })}>
              {content.clear}
            </Link>
          )}
        </div>
      </form>
    </section>
  );
}
