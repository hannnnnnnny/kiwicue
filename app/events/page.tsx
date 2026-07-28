import type { Metadata } from "next";
import { EventsPageContent } from "../../components/events-page-content";

export const metadata: Metadata = {
  title: "Auckland events — KiwiCue",
  description: "A date-sorted view of upcoming Auckland concerts, theatre, festivals and live events.",
};

export default function EventsPage() {
  return <EventsPageContent />;
}
