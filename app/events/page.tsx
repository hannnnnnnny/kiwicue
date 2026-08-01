import type { Metadata } from "next";
import { EventsPageContent } from "../../components/events-page-content";
import { parseEventCategory } from "../../lib/event-categories";
import { parseEventKeyword, parseVenueId } from "../../lib/event-search-params";
import { parseEventWindow } from "../../lib/event-window";

export const metadata: Metadata = {
  title: "Auckland events — KiwiCue",
  description: "A date-sorted view of upcoming Auckland concerts, theatre, festivals and live events.",
};

type EventsPageProps = {
  searchParams?: Promise<{
    category?: string | string[];
    q?: string | string[];
    venue?: string | string[];
    window?: string | string[];
  }>;
};

export function parseEventPageSearchParams(
  params: Awaited<NonNullable<EventsPageProps["searchParams"]>>,
) {
  return {
    window: parseEventWindow(params.window),
    category: parseEventCategory(params.category),
    keyword: parseEventKeyword(params.q),
    venueId: parseVenueId(params.venue),
  };
}

export default async function EventsPage({
  searchParams = Promise.resolve({}),
}: EventsPageProps = {}) {
  const params = await searchParams;
  const filters = parseEventPageSearchParams(params);
  return (
    <EventsPageContent
      category={filters.category}
      keyword={filters.keyword}
      venueId={filters.venueId}
      window={filters.window}
    />
  );
}
