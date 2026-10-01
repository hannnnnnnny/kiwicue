import { expect, it } from "vitest";
import { trustedBookingUrl, movieResultHref } from "../lib/ask/booking";

it("admit official booking https://eventcinemas.co.nz/orders/tickets#sessionId=2424552", () => { expect(trustedBookingUrl("https://eventcinemas.co.nz/orders/tickets#sessionId=2424552")).toBe("https://eventcinemas.co.nz/orders/tickets#sessionId=2424552"); });

it("admit official booking https://www.hoyts.co.nz/cinemas/albany", () => { expect(trustedBookingUrl("https://www.hoyts.co.nz/cinemas/albany")).toBe("https://www.hoyts.co.nz/cinemas/albany"); });
