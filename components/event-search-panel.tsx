"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import type { EventCategory } from "../lib/event-categories";
import { parseEventKeyword, parseVenueId } from "../lib/event-search-params";
import { useLanguage } from "./language-provider";

type VenueOption = {
  id: string;
  name: string;
};

type VenueStatus = "loading" | "ready" | "unavailable";

type EventSearchPanelProps = {
  category: EventCategory | null;
  keyword: string | null;
  venueId: string | null;
};

const copy = {
  en: {
    formLabel: "Search Auckland events",
    activityLabel: "Activity name",
    activityHelper: "Enter a complete event or artist word, for example Taylor",
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
    activityHelper: "输入完整的活动或艺人名称，例如 Taylor",
    venueLabel: "场馆",
    allVenues: "所有场馆",
    search: "搜索活动",
    searching: "正在搜索活动",
    clear: "清除筛选",
    venueUnavailable: "场馆暂时不可用",
  },
} as const;

function searchHref(
  category: EventCategory | null,
  keyword: string | null,
  venueId: string | null,
) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (keyword) params.set("q", keyword);
  if (venueId) params.set("venue", venueId);
  return `/events${params.size ? `?${params.toString()}` : ""}`;
}

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
  category,
  keyword,
  venueId,
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
      key={JSON.stringify([category, keyword, venueId])}
      category={category}
      keyword={keyword}
      venueId={venueId}
      venues={venues}
      venueStatus={venueStatus}
      content={content}
    />
  );
}

function SearchForm({
  category,
  keyword,
  venueId,
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
  const appliedHref = searchHref(category, keyword, venueId);

  useEffect(() => {
    if (!submitting || submittedHref !== appliedHref) return;
    const timeout = window.setTimeout(() => {
      setSubmitting(false);
      setSubmittedHref(null);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [appliedHref, submittedHref, submitting]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const normalizedKeyword = parseEventKeyword(draftKeyword);
    const normalizedVenue = parseVenueId(draftVenue);
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (normalizedKeyword) params.set("q", normalizedKeyword);
    if (normalizedVenue) params.set("venue", normalizedVenue);
    const href = `/events${params.size ? `?${params.toString()}` : ""}`;
    setSubmitting(true);
    setSubmittedHref(href);
    sessionStorage.setItem("kiwicue:focus-results", "1");
    router.push(href);
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
            <input
              id="event-search-name"
              name="q"
              type="search"
              value={draftKeyword}
              aria-describedby="event-search-name-helper"
              onChange={(event) => setDraftKeyword(event.target.value)}
            />
            <p id="event-search-name-helper" className="event-search-helper">
              {content.activityHelper}
            </p>
          </div>

          <div className="event-search-field event-search-field-venue">
            <label htmlFor="event-search-venue">{content.venueLabel}</label>
            <select
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
          <Link className="event-search-clear" href={searchHref(category, null, null)}>
            {content.clear}
          </Link>
        </div>
      </form>
    </section>
  );
}
