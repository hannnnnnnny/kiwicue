import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthForm } from "../components/auth-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

describe("authentication forms", () => {
  it("renders labeled email and password inputs for login", () => {
    render(<AuthForm mode="login" />);
    expect(screen.getByRole("textbox", { name: "Email" })).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Account features are not configured yet");
    expect(screen.getByRole("button", { name: "Log in" })).toBeDisabled();
  });
});
