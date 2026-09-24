import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AccountControl } from "../components/account-control";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

vi.mock("../components/auth-provider", () => ({
  useAuth: () => ({ user: null, loading: false, enabled: true }),
  supabaseBrowser: () => null,
}));

describe("account navigation", () => {
  it("gives signed-out visitors a clear login entry", () => {
    render(<AccountControl language="en" />);
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
  });
});
