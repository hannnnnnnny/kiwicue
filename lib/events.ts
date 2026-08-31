export interface AucklandVenue {
  id: string;
  name: string;
}

export interface EventCoordinates {
  latitude: number;
  longitude: number;
}

export interface KiwiCueVenue {
  id: string;
  name: string;
  city: string;
  address: string | null;
  postalCode: string | null;
  coordinates: EventCoordinates | null;
}

export interface EventSource {
  name: string;
  url: string;
  verifiedAt: string;
  provenance?: "official-listing" | "recurring-schedule";
}

export interface EventEditorialImage {
  url: string;
  alt: string;
  sourceName: string;
  sourceUrl: string;
  verifiedAt: string;
}

export interface EventEditorialPreview {
  summary: string;
  highlights: string[];
  image?: EventEditorialImage;
}

export interface EventLocalization {
  zh?: {
    name?: string;
    description?: string;
    note?: string;
    previewSummary?: string;
    previewHighlights?: string[];
    previewImageAlt?: string;
  };
}

export type EventExperienceKind =
  | "official"
  | "first-visit"
  | "historical-report"
  | "historical-organizer";

export interface EventExperienceSource {
  name: string;
  url: string;
  checkedAt: string;
  scope: string;
}

export interface EventExperienceLink {
  label: string;
  labelZh: string;
  url: string;
}

export interface EventExperienceSection {
  kind: EventExperienceKind;
  heading: string;
  headingZh: string;
  summary: string;
  summaryZh: string;
  points?: string[];
  pointsZh?: string[];
  disclosure?: string;
  disclosureZh?: string;
  songs?: string[];
  caveat?: string;
  caveatZh?: string;
  links?: EventExperienceLink[];
  source: EventExperienceSource;
}

export interface EventExperienceGuide {
  sections: EventExperienceSection[];
}

export type EventAdmission =
  | { kind: "free"; currency: "NZD" }
  | { kind: "range"; currency: "NZD"; min: number; max: number }
  | { kind: "unknown" };

export type EventAreaId = "central" | "north" | "west" | "south" | "east";

export interface KiwiCueEvent {
  id: string;
  name: string;
  url: string;
  imageUrl: string | null;
  start: {
    localDate: string;
    localTime: string | null;
    dateTime: string | null;
    timezone: string;
  };
  status: string;
  category: string;
  venue: KiwiCueVenue | null;
  source?: EventSource;
  localization?: EventLocalization;
  editorialPreview?: EventEditorialPreview;
  admission?: EventAdmission;
  areaId?: EventAreaId;
  organiserName?: string;
}

export function isCuratedMarketEventId(eventId: string): boolean {
  return /^kc-market-[A-Za-z0-9-]+$/.test(eventId);
}

export function isRecurringMarketEvent(event: Pick<KiwiCueEvent, "id" | "category" | "source" | "status">): boolean {
  return event.category === "Market" && isCuratedMarketEventId(event.id)
    && (event.source?.provenance === "recurring-schedule"
      || (event.status === "schedule_verified" && Boolean(event.source)));
}

export interface KiwiCueEventDetail extends KiwiCueEvent {
  description: string | null;
  note: string | null;
}

export interface EventPageMetadata {
  size: number;
  totalElements: number;
  totalPages: number;
  number: number;
}

export interface TicketmasterPageResult {
  events: KiwiCueEvent[];
  page: EventPageMetadata;
}

export interface AucklandEventsResult extends TicketmasterPageResult {
  nextCursor: string | null;
}
