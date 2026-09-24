import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EventSocialProof } from "../components/event-social-proof";

vi.mock("../components/auth-provider", () => ({
  supabaseBrowser: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => Promise.resolve({ count: 3, error: null }) }) }),
    }),
  }),
}));

describe("event social proof", () => {
  it("labels the privacy-scoped going count honestly", async () => {
    render(<EventSocialProof eventId="event_123" language="en" />);
    await waitFor(() => expect(screen.getByText("3 people publicly going")).toBeInTheDocument());
  });
});
