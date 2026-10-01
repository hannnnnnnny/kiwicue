import { expect, it } from "vitest";
import { trustedBookingUrl, movieResultHref } from "../lib/ask/booking";

it("admit official booking https://eventcinemas.co.nz/orders/tickets#sessionId=2424552", () => { expect(trustedBookingUrl("https://eventcinemas.co.nz/orders/tickets#sessionId=2424552")).toBe("https://eventcinemas.co.nz/orders/tickets#sessionId=2424552"); });

it("admit official booking https://www.hoyts.co.nz/cinemas/albany", () => { expect(trustedBookingUrl("https://www.hoyts.co.nz/cinemas/albany")).toBe("https://www.hoyts.co.nz/cinemas/albany"); });

it("admit official booking https://www.ticketmaster.co.nz/event/a", () => { expect(trustedBookingUrl("https://www.ticketmaster.co.nz/event/a")).toBe("https://www.ticketmaster.co.nz/event/a"); });

it("admit official booking https://ticketmaster.com/event/a", () => { expect(trustedBookingUrl("https://ticketmaster.com/event/a")).toBe("https://ticketmaster.com/event/a"); });

it("admit official booking https://academycinemas.co.nz/", () => { expect(trustedBookingUrl("https://academycinemas.co.nz/")).toBe("https://academycinemas.co.nz/"); });

it("admit official booking https://bridgeway.co.nz/", () => { expect(trustedBookingUrl("https://bridgeway.co.nz/")).toBe("https://bridgeway.co.nz/"); });

it("admit official booking https://lido.co.nz/", () => { expect(trustedBookingUrl("https://lido.co.nz/")).toBe("https://lido.co.nz/"); });

it("admit official booking https://readingcinemas.co.nz/", () => { expect(trustedBookingUrl("https://readingcinemas.co.nz/")).toBe("https://readingcinemas.co.nz/"); });

it("admit official booking https://silkyotter.co.nz/", () => { expect(trustedBookingUrl("https://silkyotter.co.nz/")).toBe("https://silkyotter.co.nz/"); });

it("block unsafe booking http://hoyts.co.nz/", () => { expect(trustedBookingUrl("http://hoyts.co.nz/")).toBeNull(); });

it("block unsafe booking javascript:alert(1)", () => { expect(trustedBookingUrl("javascript:alert(1)")).toBeNull(); });

it("block unsafe booking https://hoyts.co.nz.evil.example/", () => { expect(trustedBookingUrl("https://hoyts.co.nz.evil.example/")).toBeNull(); });

it("block unsafe booking https://evil-hoyts.co.nz/", () => { expect(trustedBookingUrl("https://evil-hoyts.co.nz/")).toBeNull(); });

it("block unsafe booking https://hoyts.co.nz@evil.example/", () => { expect(trustedBookingUrl("https://hoyts.co.nz@evil.example/")).toBeNull(); });

it("block unsafe booking https://user:pass@hoyts.co.nz/", () => { expect(trustedBookingUrl("https://user:pass@hoyts.co.nz/")).toBeNull(); });

it("block unsafe booking https://hoyts.co.nz:444/", () => { expect(trustedBookingUrl("https://hoyts.co.nz:444/")).toBeNull(); });

it("block unsafe booking //hoyts.co.nz/", () => { expect(trustedBookingUrl("//hoyts.co.nz/")).toBeNull(); });

it("block unsafe booking https://evil.example/?next=https://hoyts.co.nz", () => { expect(trustedBookingUrl("https://evil.example/?next=https://hoyts.co.nz")).toBeNull(); });

it("block unsafe booking https://ticketmaster.co.nz.evil.example/", () => { expect(trustedBookingUrl("https://ticketmaster.co.nz.evil.example/")).toBeNull(); });

it("block unsafe booking https://eventcinemas.co.nz/\nX", () => { expect(trustedBookingUrl("https://eventcinemas.co.nz/\nX")).toBeNull(); });

it("block unsafe booking data:text/html,hello", () => { expect(trustedBookingUrl("data:text/html,hello")).toBeNull(); });

it("block unsafe booking file:///C:/secret", () => { expect(trustedBookingUrl("file:///C:/secret")).toBeNull(); });

it("block unsafe booking https://hoyts.co.nz/a b", () => { expect(trustedBookingUrl("https://hoyts.co.nz/a b")).toBeNull(); });
