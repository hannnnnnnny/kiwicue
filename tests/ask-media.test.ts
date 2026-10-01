import { afterEach, describe, expect, it, vi } from "vitest";
import { createMediaLookup, matchTitle, type MediaSources } from "../lib/ask/media";
import type { AskCard } from "../lib/ask/schema";
import type { MoviePreview } from "../lib/movie-previews";

function movieCard(id: string, title: string): AskCard {
  return { kind: "movie", id, title, when: "2026-10-03T02:00:00.000Z", venue: "HOYTS Sylvia Park", href: `/movies?q=${title}`, imageUrl: null, priceText: null, sessionCount: 3, score: 1 };
}

function preview(id: number, title: string, posterUrl: string | null = `https://image.tmdb.org/t/p/w500/${id}.jpg`): MoviePreview {
  return { id, title, originalTitle: null, overview: null, posterUrl, releaseDate: "2026-09-20", rating: null, ratingCount: 0 };
}

function sources(overrides: Partial<MediaSources> = {}): MediaSources {
  return {
    search: vi.fn(async (title: string) => title.startsWith("Zootopia") ? [preview(9, "Zootopia 2 Special"), preview(1, "Zootopia 2")] : [preview(2, "Something Else")]),
    trailer: vi.fn(async () => "dQw4w9WgXcQ"),
    now: () => 0,
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("matchTitle", () => {
  it("ignores formats in brackets, case and punctuation", () => {
    expect(matchTitle("Zootopia 2 (3D)")).toBe("zootopia 2");
    expect(matchTitle("ZOOTOPIA 2 [IMAX]")).toBe("zootopia 2");
    expect(matchTitle("Fast & Furious")).toBe("fast and furious");
  });
});

describe("createMediaLookup", () => {
  it("finds the exact-title poster for movie cards and the trailer only for the best match", async () => {
    const all = sources();
    const lookup = createMediaLookup(all);
    const cards = [movieCard("movie:zootopia 2", "Zootopia 2 (3D)"), movieCard("movie:other", "Other Film"), { ...movieCard("e", "Event"), kind: "event" as const }];
    const media = await lookup({ cards, bestId: "movie:zootopia 2", language: "en" });
    expect(media).toEqual([{ id: "movie:zootopia 2", imageUrl: "https://image.tmdb.org/t/p/w500/1.jpg", trailerKey: "dQw4w9WgXcQ" }]);
    expect(all.search).toHaveBeenCalledWith("Zootopia 2");
    expect(all.search).toHaveBeenCalledTimes(2);
    expect(all.trailer).toHaveBeenCalledWith(1, "en");
  });

  it("caches lookups for six hours", async () => {
    let now = 0;
    const all = sources({ now: () => now });
    const lookup = createMediaLookup(all);
    const cards = [movieCard("m", "Zootopia 2")];
    await lookup({ cards, bestId: "m", language: "zh" });
    await lookup({ cards, bestId: "m", language: "zh" });
    expect(all.search).toHaveBeenCalledTimes(1);
    expect(all.trailer).toHaveBeenCalledTimes(1);
    now = 6 * 3_600_000 + 1;
    await lookup({ cards, bestId: "m", language: "zh" });
    expect(all.search).toHaveBeenCalledTimes(2);
  });

  it("rejects unsafe images and trailer keys, looks at six movies at most, and survives TMDB failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const unsafe = createMediaLookup(sources({
      search: vi.fn(async () => [preview(1, "Zootopia 2", "https://evil.example/x.jpg")]),
      trailer: vi.fn(async () => "<script>"),
    }));
    expect(await unsafe({ cards: [movieCard("m", "Zootopia 2")], bestId: "m", language: "en" })).toEqual([]);

    const many = sources();
    const cards = Array.from({ length: 8 }, (_, index) => movieCard(`m${index}`, `Film ${index}`));
    await createMediaLookup(many)({ cards, bestId: null, language: "en" });
    expect(many.search).toHaveBeenCalledTimes(6);

    const failing = createMediaLookup(sources({ search: vi.fn(async () => { throw new Error("tmdb down"); }) }));
    expect(await failing({ cards: [movieCard("m", "Zootopia 2")], bestId: "m", language: "en" })).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("\"step\":\"media\""));
  });
});
