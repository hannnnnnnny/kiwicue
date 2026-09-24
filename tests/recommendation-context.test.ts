import { describe, expect, it } from "vitest";
import { buildRecommendationContext } from "../lib/ai/recommendation-context";

describe("AI-ready recommendation context", () => {
  it("includes bounded preferences but excludes identity and credentials", () => {
    const context = buildRecommendationContext({
      interests: ["live-music", "markets"], savedCategories: ["Music"],
      goingEventIds: ["evt_1"], city: "Auckland", email: "private@example.com",
    });
    expect(context).toMatchObject({ interests: ["live-music", "markets"], city: "Auckland" });
    expect(JSON.stringify(context)).not.toContain("private@example.com");
    expect(context).not.toHaveProperty("email");
  });
});
