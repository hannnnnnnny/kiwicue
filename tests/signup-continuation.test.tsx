import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "../components/auth-form";

const { replace, refresh, signInWithPassword } = vi.hoisted(() => ({
  replace: vi.fn(), refresh: vi.fn(), signInWithPassword: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("../components/auth-provider", () => ({
  supabaseBrowser: () => ({ auth: { signInWithPassword } }),
}));
vi.mock("../components/language-provider", () => ({ useLanguage: () => ({ language: "en" }) }));
vi.mock("../components/portal-header", () => ({ PortalHeader: () => null }));

function fillSignup() {
  fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "person@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
}

describe("cross-device signup continuation", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("automatically signs in only once when another device confirms the email", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ pending: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ confirmed: false }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ confirmed: true }) });
    vi.stubGlobal("fetch", fetchMock);
    signInWithPassword.mockResolvedValue({ error: null });
    render(<AuthForm mode="signup" />);
    await act(async () => fillSignup());
    expect(screen.getByRole("status")).toHaveTextContent("Waiting for email confirmation");
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "person@example.com", password: "password123" });
    expect(replace).toHaveBeenCalledWith("/account");
    expect(refresh).toHaveBeenCalled();
  });

  it("stops waiting after the bounded confirmation period", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ pending: true }) })
      .mockResolvedValue({ ok: true, json: async () => ({ confirmed: false }) }));
    render(<AuthForm mode="signup" />);
    await act(async () => fillSignup());
    await act(async () => { await vi.advanceTimersByTimeAsync(15 * 60_000 + 20_000); });
    expect(screen.getByRole("alert")).toHaveTextContent("Verification wait expired");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("keeps checking and completes when the desktop tab is in the background", async () => {
    vi.useFakeTimers();
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ pending: true }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ confirmed: true }) }));
    signInWithPassword.mockResolvedValue({ error: null });
    render(<AuthForm mode="signup" />);
    await act(async () => fillSignup());
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(signInWithPassword).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/account");
  });
});
