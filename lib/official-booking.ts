const TRUSTED_BOOKING_HOSTS = [
  "academycinemas.co.nz", "bridgeway.co.nz", "eventcinemas.co.nz", "hoyts.co.nz", "lido.co.nz",
  "readingcinemas.co.nz", "rialto.co.nz", "silkyotter.co.nz", "thecapitol.co.nz", "veezi.com",
] as const;

export function isTrustedOfficialBookingUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 2_048) return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLocaleLowerCase("en-NZ");
    return url.protocol === "https:" && url.username === "" && url.password === "" && url.port === ""
      && TRUSTED_BOOKING_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}
