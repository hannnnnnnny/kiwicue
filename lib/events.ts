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
  venue: {
    name: string;
    city: string;
    address: string | null;
  } | null;
}

export interface AucklandEventsResult {
  events: KiwiCueEvent[];
  page: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
}
