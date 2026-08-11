import "server-only";

import { Temporal } from "@js-temporal/polyfill";
import type { EventWindow } from "./event-window";
import { resolveEventWindow } from "./event-window";
import type {
  AucklandEventsResult,
  AucklandVenue,
  EventCoordinates,
  KiwiCueEvent,
  KiwiCueEventDetail,
  KiwiCueVenue,
} from "./events";

const TIME_ZONE = "Pacific/Auckland";
const CURATED_PREFIX = "kc-market-";
const DEFAULT_SIZE = 50;
const MAX_SIZE = 50;

export const CURATED_MARKET_VERIFIED_AT = "2026-08-12";

type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface WeeklySchedule {
  weekday: Weekday;
  hour: number;
  minute: number;
}

interface MarketDefinition {
  id: string;
  name: string;
  zhName: string;
  description: string;
  zhDescription: string;
  note: string;
  zhNote: string;
  sourceName: string;
  sourceUrl: string;
  venue: KiwiCueVenue;
  schedules: readonly WeeklySchedule[];
}

export interface CuratedMarketOptions {
  now?: Date;
  size?: number;
  window?: EventWindow;
  keyword?: string | null;
  venueId?: string | null;
}

function coordinates(latitude: number, longitude: number): EventCoordinates {
  return { latitude, longitude };
}

function venue(
  id: string,
  name: string,
  address: string,
  postalCode: string | null,
  point: EventCoordinates,
): KiwiCueVenue {
  return {
    id,
    name,
    city: "Auckland",
    address,
    postalCode,
    coordinates: point,
  };
}

const nightMarketDescription =
  "A weekly evening food market at an Auckland shopping destination.";
const nightMarketDescriptionZh =
  "每周在奥克兰购物中心举办的夜间美食市集。";
const nightMarketNote =
  "The organiser lists this location from 5 pm until late. Confirm holiday or closure changes before travelling.";
const nightMarketNoteZh =
  "主办方公布的时间为下午 5 点至深夜；节假日或临时停办时，请在出发前查看官网。";
const nightMarketSource = "https://www.aucklandnightmarkets.co.nz/locations";

function nightMarket(
  slug: string,
  locationName: string,
  zhLocationName: string,
  marketVenue: KiwiCueVenue,
  weekday: Weekday,
): MarketDefinition {
  return {
    id: `${CURATED_PREFIX}${slug}`,
    name: `Auckland Night Market — ${locationName}`,
    zhName: `奥克兰夜市 · ${zhLocationName}`,
    description: nightMarketDescription,
    zhDescription: nightMarketDescriptionZh,
    note: nightMarketNote,
    zhNote: nightMarketNoteZh,
    sourceName: "Auckland Night Markets",
    sourceUrl: nightMarketSource,
    venue: marketVenue,
    schedules: [{ weekday, hour: 17, minute: 0 }],
  };
}

const MARKET_DEFINITIONS: readonly MarketDefinition[] = [
  nightMarket(
    "night-kelston",
    "Kelston",
    "Kelston",
    venue(
      "kc-venue-night-kelston",
      "Kelston Mall",
      "16 West Coast Road, Kelston",
      "0602",
      coordinates(-36.9092682, 174.6638754),
    ),
    1,
  ),
  nightMarket(
    "night-albany",
    "Albany",
    "Albany",
    venue(
      "kc-venue-night-albany",
      "North Harbour Stadium",
      "Stadium Drive, Albany",
      "0632",
      coordinates(-36.727308, 174.7023656),
    ),
    2,
  ),
  nightMarket(
    "night-botany",
    "Botany",
    "Botany",
    venue(
      "kc-venue-night-botany",
      "Botany Town Centre",
      "588 Chapel Road, East Tāmaki",
      "2013",
      coordinates(-36.9322647, 174.9131539),
    ),
    3,
  ),
  nightMarket(
    "night-highbury",
    "Highbury",
    "Highbury",
    venue(
      "kc-venue-night-highbury",
      "Highbury Shopping Centre",
      "Mokoia Road, Birkenhead",
      "0627",
      coordinates(-36.8110064, 174.7245999),
    ),
    3,
  ),
  nightMarket(
    "night-henderson",
    "Henderson",
    "Henderson",
    venue(
      "kc-venue-night-henderson",
      "WestCity Waitākere",
      "7 Catherine Street, Henderson",
      "0612",
      coordinates(-36.8809222, 174.6327023),
    ),
    4,
  ),
  nightMarket(
    "night-papatoetoe",
    "Papatoetoe",
    "Papatoetoe",
    venue(
      "kc-venue-night-papatoetoe",
      "Hunters Plaza",
      "217 Great South Road, Papatoetoe",
      "2025",
      coordinates(-36.9702868, 174.8612181),
    ),
    5,
  ),
  nightMarket(
    "night-pakuranga",
    "Pakuranga",
    "Pakuranga",
    venue(
      "kc-venue-night-pakuranga",
      "Pakuranga Plaza",
      "130 Pakuranga Road, Pakūranga",
      "2010",
      coordinates(-36.9125398, 174.8714538),
    ),
    6,
  ),
  nightMarket(
    "night-silverdale",
    "Silverdale",
    "Silverdale",
    venue(
      "kc-venue-night-silverdale",
      "Silverdale Centre",
      "61 Silverdale Street, Silverdale",
      "0932",
      coordinates(-36.6147318, 174.6803813),
    ),
    7,
  ),
  {
    id: "kc-market-avondale-sunday",
    name: "Avondale Sunday Market",
    zhName: "Avondale 周日市集",
    description:
      "A long-running Sunday market with fresh produce, prepared food, and second-hand stalls.",
    zhDescription:
      "历史悠久的周日市集，汇集新鲜果蔬、熟食和二手摊位。",
    note:
      "The published schedule is Sunday from 6 am to noon, except Christmas. Confirm exceptions before travelling.",
    zhNote:
      "官网公布的时间为每周日上午 6 点至中午，圣诞节除外；出发前请确认临时调整。",
    sourceName: "Avondale Mainstreet",
    sourceUrl: "https://www.avondale.net.nz/avondale-sunday-market",
    venue: venue(
      "kc-venue-avondale-sunday",
      "Avondale Racecourse",
      "2 Ash Street, Avondale",
      "1026",
      coordinates(-36.8947502, 174.6903662),
    ),
    schedules: [{ weekday: 7, hour: 6, minute: 0 }],
  },
  {
    id: "kc-market-grey-lynn",
    name: "Grey Lynn Farmers Market",
    zhName: "Grey Lynn 农夫市集",
    description:
      "A community-run Sunday market focused on local produce and small-scale food makers.",
    zhDescription:
      "社区运营的周日市集，主打本地农产品和小型食品生产者。",
    note:
      "The published schedule is every Sunday from 8:30 am to noon. Check the organiser's latest update before travelling.",
    zhNote:
      "官网公布的时间为每周日上午 8:30 至中午；出发前请查看主办方最新通知。",
    sourceName: "Grey Lynn Farmers Market",
    sourceUrl: "https://www.greylynnfarmersmarket.co.nz/",
    venue: venue(
      "kc-venue-grey-lynn",
      "Grey Lynn Community Centre",
      "510 Richmond Road, Grey Lynn",
      "1022",
      coordinates(-36.8597672, 174.7330018),
    ),
    schedules: [{ weekday: 7, hour: 8, minute: 30 }],
  },
  {
    id: "kc-market-catalina-bay",
    name: "Catalina Bay Farmers Market",
    zhName: "Catalina Bay 农夫市集",
    description:
      "A covered waterfront artisan market with local produce, food makers, and handmade goods.",
    zhDescription:
      "位于海滨的有顶棚手作市集，汇集本地农产品、食品和手工艺品。",
    note:
      "The published schedule is Saturday and Sunday from 8:30 am to 2 pm. Confirm special closures before travelling.",
    zhNote:
      "官网公布的时间为周六和周日上午 8:30 至下午 2 点；出发前请确认临时停办安排。",
    sourceName: "Catalina Bay Precinct",
    sourceUrl: "https://www.catalinabay.co.nz/farmers-market",
    venue: venue(
      "kc-venue-catalina-bay",
      "Catalina Bay",
      "Catalina Bay Drive, Hobsonville Point",
      "0616",
      coordinates(-36.794374, 174.6705301),
    ),
    schedules: [
      { weekday: 6, hour: 8, minute: 30 },
      { weekday: 7, hour: 8, minute: 30 },
    ],
  },
];

function clampSize(size = DEFAULT_SIZE): number {
  if (!Number.isFinite(size)) return DEFAULT_SIZE;
  return Math.min(MAX_SIZE, Math.max(1, Math.trunc(size)));
}

function nextScheduledTime(
  schedule: WeeklySchedule,
  now: Temporal.ZonedDateTime,
): Temporal.ZonedDateTime {
  const dayDelta = (schedule.weekday - now.dayOfWeek + 7) % 7;
  const date = now.toPlainDate().add({ days: dayDelta });
  let candidate = date.toZonedDateTime({
    timeZone: TIME_ZONE,
    plainTime: Temporal.PlainTime.from({
      hour: schedule.hour,
      minute: schedule.minute,
    }),
  });
  if (Temporal.ZonedDateTime.compare(candidate, now) < 0) {
    candidate = candidate.add({ days: 7 });
  }
  return candidate;
}

function nextDefinitionTime(
  definition: MarketDefinition,
  now: Temporal.ZonedDateTime,
): Temporal.ZonedDateTime {
  return definition.schedules
    .map((schedule) => nextScheduledTime(schedule, now))
    .reduce((earliest, candidate) =>
      Temporal.ZonedDateTime.compare(candidate, earliest) < 0
        ? candidate
        : earliest,
    );
}

function toEvent(
  definition: MarketDefinition,
  next: Temporal.ZonedDateTime,
): KiwiCueEventDetail {
  return {
    id: definition.id,
    name: definition.name,
    url: definition.sourceUrl,
    imageUrl: null,
    start: {
      localDate: next.toPlainDate().toString(),
      localTime: next.toPlainTime().toString({ smallestUnit: "second" }),
      dateTime: next.toInstant().toString(),
      timezone: TIME_ZONE,
    },
    status: "schedule_verified",
    category: "Market",
    venue: { ...definition.venue },
    source: {
      name: definition.sourceName,
      url: definition.sourceUrl,
      verifiedAt: CURATED_MARKET_VERIFIED_AT,
    },
    localization: {
      zh: {
        name: definition.zhName,
        description: definition.zhDescription,
        note: definition.zhNote,
      },
    },
    description: definition.description,
    note: definition.note,
  };
}

function buildNextOccurrences(now: Date): KiwiCueEventDetail[] {
  if (!Number.isFinite(now.getTime())) throw new RangeError("Invalid market anchor");
  const anchor = Temporal.Instant.fromEpochMilliseconds(now.getTime())
    .toZonedDateTimeISO(TIME_ZONE);
  return MARKET_DEFINITIONS.map((definition) =>
    toEvent(definition, nextDefinitionTime(definition, anchor)),
  );
}

function normalizedSearchText(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("en-NZ");
}

function matchesKeyword(event: KiwiCueEventDetail, keyword?: string | null): boolean {
  if (!keyword) return true;
  const query = normalizedSearchText(keyword);
  if (!query) return true;
  const searchable = [
    event.name,
    event.localization?.zh?.name,
    event.description,
    event.localization?.zh?.description,
    event.venue?.name,
    event.venue?.address,
  ].filter((value): value is string => Boolean(value));
  return normalizedSearchText(searchable.join(" ")).includes(query);
}

function matchesWindow(
  event: KiwiCueEvent,
  window: EventWindow,
  now: Date,
): boolean {
  const timestamp = event.start.dateTime ? Date.parse(event.start.dateTime) : Number.NaN;
  if (!Number.isFinite(timestamp)) return false;
  const range = resolveEventWindow(window, now);
  return timestamp >= range.start.getTime()
    && (range.end === null || timestamp < range.end.getTime());
}

function compareEvents(left: KiwiCueEvent, right: KiwiCueEvent): number {
  const timeDifference = Date.parse(left.start.dateTime ?? "")
    - Date.parse(right.start.dateTime ?? "");
  return timeDifference || left.name.localeCompare(right.name, "en-NZ");
}

export function isCuratedMarketId(eventId: string): boolean {
  return eventId.startsWith(CURATED_PREFIX);
}

export function listCuratedMarkets({
  now = new Date(),
  size: requestedSize,
  window = "all",
  keyword,
  venueId,
}: CuratedMarketOptions = {}): AucklandEventsResult {
  const size = clampSize(requestedSize);
  const matching = buildNextOccurrences(now)
    .filter((event) => matchesWindow(event, window, now))
    .filter((event) => matchesKeyword(event, keyword))
    .filter((event) => !venueId || event.venue?.id === venueId)
    .sort(compareEvents);
  const totalElements = matching.length;
  return {
    events: matching.slice(0, size),
    page: {
      size,
      totalElements,
      totalPages: Math.ceil(totalElements / size),
      number: 0,
    },
    nextCursor: null,
  };
}

export function findCuratedMarketDetail(
  eventId: string,
  now = new Date(),
): KiwiCueEventDetail | null {
  const definition = MARKET_DEFINITIONS.find((item) => item.id === eventId);
  if (!definition) return null;
  const anchor = Temporal.Instant.fromEpochMilliseconds(now.getTime())
    .toZonedDateTimeISO(TIME_ZONE);
  return toEvent(definition, nextDefinitionTime(definition, anchor));
}

export function listCuratedMarketVenues(): AucklandVenue[] {
  return MARKET_DEFINITIONS.map((definition) => ({
    id: definition.venue.id,
    name: definition.venue.name,
  })).sort((left, right) =>
    left.name.localeCompare(right.name, "en-NZ", { sensitivity: "base" }),
  );
}
