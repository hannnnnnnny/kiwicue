import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SaveToCollection } from "../components/save-to-collection";
import { makeEvent } from "./fixtures/social-event";

vi.mock("../components/auth-provider", () => ({
  useAuth: () => ({ user: null, loading: false, enabled: true }),
  supabaseBrowser: () => ({ /* Supabase is configured for this UI test. */ }),
}));

describe("collection save entry", () => {
  it("uses account login for a guest instead of pretending the item is cloud-saved", () => {
    render(<SaveToCollection event={makeEvent("A")} />);
    expect(screen.getByRole("link", { name: "Log in to use collections" })).toHaveAttribute("href", "/login?next=/events/A");
  });
});
