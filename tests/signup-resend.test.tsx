import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthForm } from "../components/auth-form";

const { replace, refresh, signInWithPassword } = vi.hoisted(() => ({
  replace: vi.fn(), refresh: vi.fn(), signInWithPassword: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));
vi.mock("../components/auth-provider", () => ({ supabaseBrowser: () => ({ auth: { signInWithPassword } }) }));
vi.mock("../components/language-provider", () => ({ useLanguage: () => ({ language: "en" }) }));
vi.mock("../components/portal-header", () => ({ PortalHeader: () => null }));

type Reply = { status: number; body: unknown };
const json = ({ status, body }: Reply) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/** Routes fetch by URL so the background confirmation poll never consumes a resend reply. */
function stubFetch(resendReplies: Reply[]) {
  const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<ReturnType<typeof json>>>(async (input) => {
    if (input === "/api/auth/signup") return json({ status: 200, body: { pending: true } });
    if (input === "/api/auth/signup-status") return json({ status: 200, body: { confirmed: false } });
    if (input === "/api/auth/signup-status/resend") return json(resendReplies.shift() ?? { status: 503, body: {} });
    throw new Error(`Unexpected fetch ${input}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function startSignup() {
  render(<AuthForm mode="signup" />);
  await act(async () => {
    fireEvent.change(screen.getByRole("textbox", { name: "Email" }), { target: { value: "person@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
  });
}

const resendCalls = (fetchMock: ReturnType<typeof stubFetch>) =>
  fetchMock.mock.calls.filter(([input]) => input === "/api/auth/signup-status/resend");

describe("signup confirmation resend", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("always offers log-in and password-reset routes while waiting", async () => {
    stubFetch([]);
    await startSignup();
    expect(screen.getByText(/signed up with this email before/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "log in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "reset your password" })).toHaveAttribute("href", "/forgot-password");
  });

  it("holds the button through the first-email cooldown, then resends and cools down again", async () => {
    vi.useFakeTimers();
    const fetchMock = stubFetch([{ status: 200, body: { sent: true } }]);
    await startSignup();
    expect(screen.getByRole("button", { name: "Resend in 60s" })).toBeDisabled();

    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    const button = screen.getByRole("button", { name: "Resend email" });
    expect(button).toBeEnabled();

    await act(async () => { fireEvent.click(button); });
    expect(resendCalls(fetchMock)).toHaveLength(1);
    expect(resendCalls(fetchMock)[0][1]).toMatchObject({ method: "POST", credentials: "same-origin" });
    expect(screen.getByText(/Sent again/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Resend in 60s" })).toBeDisabled();
  });

  it("explains a rate limit and restarts the cooldown", async () => {
    vi.useFakeTimers();
    stubFetch([{ status: 429, body: { sent: false } }]);
    await startSignup();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Resend email" })); });
    expect(screen.getByRole("alert")).toHaveTextContent("Too many requests");
    expect(screen.getByRole("button", { name: "Resend in 60s" })).toBeDisabled();
  });

  it("moves straight to sign-in when the account turns out to be confirmed", async () => {
    vi.useFakeTimers();
    stubFetch([{ status: 409, body: { confirmed: true } }]);
    signInWithPassword.mockResolvedValue({ error: null });
    await startSignup();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Resend email" })); });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "person@example.com", password: "password123" });
    expect(replace).toHaveBeenCalledWith("/account");
  });
});
