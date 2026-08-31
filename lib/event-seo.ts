import type { Metadata } from "next";
import { isRecurringMarketEvent, type KiwiCueEventDetail } from "./events";

const SITE_ORIGIN = new URL("https://kiwicue.vercel.app");

function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function shortDescription(event: KiwiCueEventDetail): string {
  const fallback = [event.category, event.venue?.name, event.start.localDate].filter(Boolean).join(" · ");
  return [...(event.description ?? event.editorialPreview?.summary ?? fallback)].slice(0, 160).join("");
}

export function buildEventMetadata(event: KiwiCueEventDetail): Metadata {
  const title = `${event.name} — KiwiCue`;
  const description = shortDescription(event);
  const image = safeHttpUrl(event.imageUrl);
  return {
    title,
    description,
    alternates: { canonical: `/events/${encodeURIComponent(event.id)}` },
    openGraph: {
      title,
      description,
      type: "website",
      url: new URL(`/events/${encodeURIComponent(event.id)}`, SITE_ORIGIN),
      ...(image ? { images: [{ url: image }] } : {}),
    },
  };
}

function eventStatus(status: string): string | undefined {
  const statuses: Record<string, string> = {
    cancelled: "https://schema.org/EventCancelled",
    postponed: "https://schema.org/EventPostponed",
    rescheduled: "https://schema.org/EventRescheduled",
    onsale: "https://schema.org/EventScheduled",
    schedule_verified: "https://schema.org/EventScheduled",
  };
  return statuses[status.trim().toLowerCase()];
}

export function buildEventJsonLd(event: KiwiCueEventDetail): Record<string, unknown> {
  const officialUrl = safeHttpUrl(event.source?.url ?? event.url);
  const image = safeHttpUrl(event.imageUrl);
  const status = eventStatus(event.status);
  const offers = event.admission?.kind === "free"
    ? { "@type": "Offer", price: 0, priceCurrency: "NZD", ...(officialUrl ? { url: officialUrl } : {}) }
    : event.admission?.kind === "range"
      ? { "@type": "AggregateOffer", lowPrice: event.admission.min, highPrice: event.admission.max, priceCurrency: "NZD", ...(officialUrl ? { url: officialUrl } : {}) }
      : null;
  const location = event.venue ? {
    "@type": "Place",
    name: event.venue.name,
    ...(event.venue.address ? { address: {
      "@type": "PostalAddress",
      streetAddress: event.venue.address,
      addressLocality: event.venue.city,
      ...(event.venue.postalCode ? { postalCode: event.venue.postalCode } : {}),
      addressCountry: "NZ",
    } } : {}),
  } : undefined;
  if (isRecurringMarketEvent(event)) {
    return {
      "@context": "https://schema.org",
      "@type": "Place",
      name: event.name,
      description: shortDescription(event),
      url: officialUrl ?? new URL(`/events/${encodeURIComponent(event.id)}`, SITE_ORIGIN).toString(),
      ...(location ? { location } : {}),
    };
  }
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: event.name,
    startDate: event.start.dateTime ?? `${event.start.localDate}T${event.start.localTime ?? "00:00:00"}`,
    url: new URL(`/events/${encodeURIComponent(event.id)}`, SITE_ORIGIN).toString(),
    ...(status ? { eventStatus: status } : {}),
    ...(image ? { image: [image] } : {}),
    ...(location ? { location } : {}),
    ...(event.organiserName ? { organizer: { "@type": "Organization", name: event.organiserName } } : {}),
    ...(offers ? { offers } : {}),
  };
}

export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</gu, "\\u003c")
    .replace(/>/gu, "\\u003e")
    .replace(/&/gu, "\\u0026")
    .replace(/\u2028/gu, "\\u2028")
    .replace(/\u2029/gu, "\\u2029");
}
