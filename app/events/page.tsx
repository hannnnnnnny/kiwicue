import type { Metadata } from "next";
import { EventsPageContent } from "../../components/events-page-content";
import { parseEventCategory } from "../../lib/event-categories";

export const metadata: Metadata = {
  title: "Auckland events — KiwiCue",
  description: "A date-sorted view of upcoming Auckland concerts, theatre, festivals and live events.",
};

type EventsPageProps = {
  searchParams?: Promise<{ category?: string | string[] }>;
};

export default async function EventsPage({
  searchParams = Promise.resolve({}),
}: EventsPageProps = {}) {
  const params = await searchParams;
  return <EventsPageContent category={parseEventCategory(params.category)} />;
}
