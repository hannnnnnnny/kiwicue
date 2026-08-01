import type { Metadata } from "next";
import { EventDetailContent } from "../../../components/event-detail-content";

export const metadata: Metadata = {
  title: "Event details — KiwiCue",
  description: "Official Auckland event information, venue map, distance and booking route.",
};

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <EventDetailContent eventId={eventId} />;
}
