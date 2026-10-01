import { isTrustedOfficialBookingUrl } from "../official-booking";

/** Ticketmaster and cinema links are admitted explicitly; model-generated URLs are never used. */
export function trustedBookingUrl(value: unknown): string | null {
  if (typeof value !== "string" || /[\u0000-\u0020\u007f]/u.test(value) || value.length > 2048) return null;
  if (isTrustedOfficialBookingUrl(value)) return value;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const ticketmaster = ["ticketmaster.co.nz", "ticketmaster.com"].some((base) => host === base || host.endsWith(`.${base}`));
    return url.protocol === "https:" && !url.username && !url.password && !url.port && ticketmaster ? value : null;
  } catch { return null; }
}

export function movieResultHref(title: string, when: string, cinemaId: string): string {
  const query = new URLSearchParams({ q: title, date: "all", session: when, cinema: cinemaId });
  return `/movies?${query}`;
}
