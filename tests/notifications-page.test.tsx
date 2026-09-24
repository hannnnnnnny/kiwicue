import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotificationsPageContent } from "../components/notifications-page-content";

vi.mock("../components/auth-provider", () => ({
  useAuth: () => ({ user: null, loading: false, enabled: true }),
  supabaseBrowser: () => null,
}));

describe("notifications page", () => {
  it("does not render private notifications before login", () => {
    render(<NotificationsPageContent />);
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login?next=/notifications");
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
