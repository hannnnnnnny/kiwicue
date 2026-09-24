import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountSettings } from "../components/account-settings";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

vi.mock("../components/auth-provider", () => ({
  useAuth: () => ({ user: null, loading: false, enabled: true }),
  supabaseBrowser: () => null,
}));

describe("account settings", () => {
  it("directs signed-out visitors to login instead of showing private fields", () => {
    render(<AccountSettings />);
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login?next=/account");
    expect(screen.queryByText("Delete account")).not.toBeInTheDocument();
  });
});
