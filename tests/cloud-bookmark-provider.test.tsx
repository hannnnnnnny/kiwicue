import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookmarkProvider, useBookmarks } from "../components/bookmark-provider";
import { BOOKMARK_STORAGE_KEY, serializeBookmarks, toBookmark } from "../lib/bookmarks";
import { makeEvent } from "./fixtures/social-event";

vi.mock("../components/auth-provider", () => ({
  useAuth: () => ({ user: { id: "user-one" }, loading: false, enabled: true }),
}));

function Probe() {
  const { count } = useBookmarks();
  return <output aria-label="bookmark count">{count}</output>;
}

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

describe("cloud bookmark migration", () => {
  it("unions cloud and guest saves before removing migrated local data", async () => {
    localStorage.setItem(BOOKMARK_STORAGE_KEY, serializeBookmarks([toBookmark(makeEvent("B"))]));
    const requests: { method: string; body?: string }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, options?: RequestInit) => {
      requests.push({ method: options?.method ?? "GET", body: options?.body?.toString() });
      return new Response(JSON.stringify(options?.method === "POST"
        ? { saved: ["B"] }
        : { bookmarks: [toBookmark(makeEvent("A"))] }), { status: 200 });
    }));
    render(<BookmarkProvider><Probe /></BookmarkProvider>);
    await waitFor(() => expect(screen.getByLabelText("bookmark count")).toHaveTextContent("2"));
    expect(requests.map(({ method }) => method)).toEqual(["GET", "POST"]);
    expect(localStorage.getItem(BOOKMARK_STORAGE_KEY)).toBeNull();
  });
  it("keeps the guest copy when the server does not confirm a migrated event", async () => {
    localStorage.setItem(BOOKMARK_STORAGE_KEY, serializeBookmarks([toBookmark(makeEvent("B"))]));
    vi.stubGlobal("fetch", vi.fn(async (_url: string, options?: RequestInit) => new Response(JSON.stringify(
      options?.method === "POST" ? { saved: [] } : { bookmarks: [] },
    ), { status: 200 })));
    render(<BookmarkProvider><Probe /></BookmarkProvider>);
    await waitFor(() => expect(screen.getByLabelText("bookmark count")).toHaveTextContent("1"));
    expect(localStorage.getItem(BOOKMARK_STORAGE_KEY)).not.toBeNull();
  });
});
