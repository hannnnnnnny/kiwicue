import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EventDetailContent } from "../../../components/event-detail-content";
import { EventPageDataError, loadEventPageData, loadRelatedEventCandidates } from "../../../lib/event-detail-data";
import { selectOtherSessions, selectRelatedEvents } from "../../../lib/event-related";
import { buildEventJsonLd, buildEventMetadata, serializeJsonLd } from "../../../lib/event-seo";

type PageProps = { params: Promise<{ eventId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { eventId } = await params;
  try {
    return buildEventMetadata(await loadEventPageData(eventId));
  } catch (error) {
    return error instanceof EventPageDataError && error.status === 404
      ? { title: "Event not found — KiwiCue" }
      : { title: "Event details — KiwiCue" };
  }
}

export default async function EventDetailPage({ params }: PageProps) {
  const { eventId } = await params;
  let event;
  try {
    event = await loadEventPageData(eventId);
  } catch (error) {
    if (error instanceof EventPageDataError) {
      if (error.status === 404) notFound();
      return <EventDetailContent eventId={eventId} />;
    }
    throw error;
  }
  const candidates = await loadRelatedEventCandidates();
  const relatedEvents = selectRelatedEvents(event, candidates, new Date(), 3);
  const otherSessions = selectOtherSessions(event, candidates);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildEventJsonLd(event)) }} />
      <EventDetailContent initialEvent={event} relatedEvents={relatedEvents} otherSessions={otherSessions} />
    </>
  );
}
