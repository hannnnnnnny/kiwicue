import { expect, it } from "vitest";
import { trustedBookingUrl, movieResultHref } from "../lib/ask/booking";

it("admit official booking https://eventcinemas.co.nz/orders/tickets#sessionId=2424552", () => { expect(trustedBookingUrl("https://eventcinemas.co.nz/orders/tickets#sessionId=2424552")).toBe("https://eventcinemas.co.nz/orders/tickets#sessionId=2424552"); });

it("admit official booking https://www.hoyts.co.nz/cinemas/albany", () => { expect(trustedBookingUrl("https://www.hoyts.co.nz/cinemas/albany")).toBe("https://www.hoyts.co.nz/cinemas/albany"); });

it("admit official booking https://www.ticketmaster.co.nz/event/a", () => { expect(trustedBookingUrl("https://www.ticketmaster.co.nz/event/a")).toBe("https://www.ticketmaster.co.nz/event/a"); });

it("admit official booking https://ticketmaster.com/event/a", () => { expect(trustedBookingUrl("https://ticketmaster.com/event/a")).toBe("https://ticketmaster.com/event/a"); });

it("admit official booking https://academycinemas.co.nz/", () => { expect(trustedBookingUrl("https://academycinemas.co.nz/")).toBe("https://academycinemas.co.nz/"); });
