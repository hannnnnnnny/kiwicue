import "server-only";

export type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
export type CinemaSourceErrorCode = "UPSTREAM_BUSY" | "UPSTREAM_TIMEOUT" | "UPSTREAM_ERROR";

const REQUEST_TIMEOUT_MS = 8_000;
// Identify KiwiCue honestly; the cinema sites serve this feed to any client.
const USER_AGENT = "KiwiCue/1.0 (+https://kiwicue.nz)";

export class CinemaSourceError extends Error {
  constructor(public readonly code: CinemaSourceErrorCode) {
    super(code);
    this.name = "CinemaSourceError";
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function boundedString(value: unknown, maximum: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

export function boundedInteger(value: unknown, maximum: number): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

/** Fetches cinema JSON through the Next data cache so repeated page views reuse one upstream call. */
export async function fetchCinemaJson(url: URL, fetchImpl: FetchImplementation, revalidate: number): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      headers: { accept: "application/json", "user-agent": USER_AGENT },
      signal: controller.signal,
      next: { revalidate },
    } as RequestInit & { next: { revalidate: number } });
    if (response.status === 429) throw new CinemaSourceError("UPSTREAM_BUSY");
    if (!response.ok) throw new CinemaSourceError("UPSTREAM_ERROR");
    return await response.json() as unknown;
  } catch (error) {
    if (error instanceof CinemaSourceError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw new CinemaSourceError("UPSTREAM_TIMEOUT");
    throw new CinemaSourceError("UPSTREAM_ERROR");
  } finally {
    clearTimeout(timeout);
  }
}

/** Runs tasks with a small concurrency cap so price lookups never fan out into a burst. */
export async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
