import { deriveEventArea } from "./event-discovery";
import { getEventExperience } from "./event-experience";
import type { EventAreaId, KiwiCueEvent } from "./events";

export type EventLocalFacet =
  | "all"
  | "guide"
  | "reference"
  | `area:${EventAreaId}`
  | `tag:${string}`;

export type EventFacetOption = {
  id: EventLocalFacet;
  label: string;
  labelZh: string;
  count: number;
};

const areaLabels: Record<EventAreaId, { label: string; labelZh: string }> = {
  central: { label: "Central Auckland", labelZh: "奥克兰市中心" },
  north: { label: "North Auckland", labelZh: "奥克兰北区" },
  west: { label: "West Auckland", labelZh: "奥克兰西区" },
  south: { label: "South Auckland", labelZh: "奥克兰南区" },
  east: { label: "East Auckland", labelZh: "奥克兰东区" },
};

function normalizedTag(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ");
}
function hasReference(event: KiwiCueEvent): boolean {
  return Boolean(getEventExperience(event)?.sections.some((section) =>
    section.kind === "historical-report" || section.kind === "historical-organizer",
  ));
}

function appendCount(
  counts: Map<string, number>,
  key: string,
): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function addTagCounts(events: KiwiCueEvent[], counts: Map<string, number>): Map<string, string> {
  const labels = new Map<string, string>();
  for (const event of events) {
    const seenForEvent = new Set<string>();
    for (const value of event.tags ?? []) {
      const label = normalizedTag(value);
      if (!label || /^(?:undefined|n\/a|na|none)$/iu.test(label)) continue;
      const key = label.toLocaleLowerCase();
      if (seenForEvent.has(key)) continue;
      seenForEvent.add(key);
      labels.set(key, label);
      appendCount(counts, key);
    }
  }
  return labels;
}

export function buildEventFacetOptions(events: KiwiCueEvent[]): EventFacetOption[] {
  if (events.length === 0) return [];
  const options: EventFacetOption[] = [{
    id: "all",
    label: "All loaded",
    labelZh: "全部已加载",
    count: events.length,
  }];
  const guideCount = events.filter((event) => Boolean(getEventExperience(event))).length;
  if (guideCount > 0) options.push({ id: "guide", label: "With a guide", labelZh: "有到访指南", count: guideCount });
  const referenceCount = events.filter(hasReference).length;
  if (referenceCount > 0) options.push({ id: "reference", label: "Previous reference", labelZh: "有往期参考", count: referenceCount });

  const areas = new Map<EventAreaId, number>();
  for (const event of events) {
    const area = deriveEventArea(event);
    if (area) appendCount(areas, area);
  }
  for (const [id, count] of areas) {
    const labels = areaLabels[id];
    options.push({ id: `area:${id}`, label: labels.label, labelZh: labels.labelZh, count });
  }

  const tagCounts = new Map<string, number>();
  const tagLabels = addTagCounts(events, tagCounts);
  for (const [key, count] of tagCounts) {
    const label = tagLabels.get(key);
    if (label) options.push({ id: `tag:${encodeURIComponent(label)}`, label, labelZh: label, count });
  }
  return options;
}

function matchesTag(event: KiwiCueEvent, encodedTag: string): boolean {
  let requested: string;
  try {
    requested = normalizedTag(decodeURIComponent(encodedTag)).toLocaleLowerCase();
  } catch {
    return false;
  }
  return (event.tags ?? []).some((tag) => normalizedTag(tag).toLocaleLowerCase() === requested);
}

export function filterEventFacet(events: KiwiCueEvent[], facet: EventLocalFacet): KiwiCueEvent[] {
  if (facet === "all") return events;
  if (facet === "guide") return events.filter((event) => Boolean(getEventExperience(event)));
  if (facet === "reference") return events.filter(hasReference);
  if (facet.startsWith("area:")) {
    const area = facet.slice("area:".length) as EventAreaId;
    return events.filter((event) => deriveEventArea(event) === area);
  }
  if (facet.startsWith("tag:")) return events.filter((event) => matchesTag(event, facet.slice("tag:".length)));
  return events;
}
