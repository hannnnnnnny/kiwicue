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
