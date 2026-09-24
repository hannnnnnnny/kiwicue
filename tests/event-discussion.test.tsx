import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventDiscussion } from "../components/event-discussion";

vi.mock("../components/auth-provider", () => ({
  useAuth: () => ({ user: null, loading: false, enabled: true }),
  supabaseBrowser: () => null,
}));

describe("event discussion", () => {
  it("offers a login link but no guest posting form", () => {
    render(<EventDiscussion eventId="abc_123" />);
    expect(screen.getByRole("link", { name: "Log in to comment" })).toHaveAttribute("href", "/login?next=/events/abc_123");
    expect(screen.queryByRole("textbox", { name: "Your comment" })).not.toBeInTheDocument();
  });
});
