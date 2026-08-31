import { describe, expect, it } from "vitest";
import { buildEventJsonLd, buildEventMetadata, serializeJsonLd } from "../lib/event-seo";
import type { KiwiCueEventDetail } from "../lib/events";

const detail: KiwiCueEventDetail = {
  id: "event-123",
  name: "Auckland Night Live",
  url: "https://tickets.example/event-123",
  imageUrl: "https://images.example/event.jpg",
  start: { localDate: "2026-09-08", localTime: "19:30:00", dateTime: "2026-09-08T07:30:00Z", timezone: "Pacific/Auckland" },
  status: "onsale",
  category: "Music",
  venue: { id: "civic", name: "The Civic", city: "Auckland", address: "269 Queen Street", postalCode: "1010", coordinates: null },
  description: "One Auckland night of live music.",
  note: null,
};

describe("event SEO", () => {
  it("builds event-specific metadata and canonical URL", () => {
    expect(buildEventMetadata(detail)).toMatchObject({
      title: "Auckland Night Live — KiwiCue",
      alternates: { canonical: "/events/event-123" },
      openGraph: { title: "Auckland Night Live — KiwiCue" },
    });
  });

  it("emits offers only for verified admission", () => {
    expect(buildEventJsonLd(detail)).not.toHaveProperty("offers");
    expect(buildEventJsonLd({ ...detail, admission: { kind: "free", currency: "NZD" } })).toMatchObject({
      offers: { "@type": "Offer", price: 0, priceCurrency: "NZD" },
    });
  });

  it("uses a general place reference for recurring market expectations", () => {
    const market = {
      ...detail,
      id: "kc-market-grey-lynn",
      name: "Grey Lynn Farmers Market",
      category: "Market",
      status: "schedule_verified",
      source: {
        name: "Grey Lynn Farmers Market",
        url: "https://www.greylynnfarmersmarket.co.nz/",
        verifiedAt: "2026-08-12",
        provenance: "recurring-schedule" as const,
      },
    };
    const jsonLd = buildEventJsonLd(market);
    expect(jsonLd).toMatchObject({ "@type": "Place" });
    expect(jsonLd).not.toHaveProperty("startDate");
    expect(jsonLd).not.toHaveProperty("eventStatus");
  });

  it("escapes script-breaking JSON-LD text", () => {
    const serialized = serializeJsonLd({ name: "</script><script>alert(1)</script>" });
    expect(serialized).not.toContain("</script>");
    expect(JSON.parse(serialized)).toEqual({ name: "</script><script>alert(1)</script>" });
  });
});
