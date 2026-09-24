import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CollectionsPageContent } from "../components/collections-page-content";

vi.mock("../components/auth-provider", () => ({
  useAuth: () => ({ user: null, loading: false, enabled: true }),
  supabaseBrowser: () => null,
}));

describe("collections", () => {
  it("asks guests to sign in rather than claiming to save a cloud collection", () => {
    render(<CollectionsPageContent />);
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login?next=/collections");
  });
});
