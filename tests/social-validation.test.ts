import { describe, expect, it } from "vitest";
import { commentInput, collectionInput, eventStatusInput, profileInput, usernameInput } from "../lib/social/validation";

describe("social input validation", () => {
  it("accepts URL-safe usernames and rejects invalid ones", () => {
    expect(usernameInput.parse("harry_606")).toBe("harry_606");
    expect(usernameInput.safeParse("Harry Name").success).toBe(false);
    expect(usernameInput.safeParse("ab").success).toBe(false);
  });

  it("trims comments and rejects empty or oversized content", () => {
    expect(commentInput.parse({ content: "  Hello Auckland  " }).content).toBe("Hello Auckland");
    expect(commentInput.safeParse({ content: "   " }).success).toBe(false);
    expect(commentInput.safeParse({ content: "x".repeat(1001) }).success).toBe(false);
  });

  it("bounds profile and collection fields", () => {
    expect(profileInput.safeParse({ username: "harry", displayName: "Harry", bio: "Hi" }).success).toBe(true);
    expect(profileInput.safeParse({ username: "harry", displayName: "x".repeat(101) }).success).toBe(false);
    expect(collectionInput.safeParse({ name: "  This weekend  ", isPublic: false }).data?.name).toBe("This weekend");
    expect(collectionInput.safeParse({ name: "" }).success).toBe(false);
  });

  it("allows only supported event intent statuses", () => {
    expect(eventStatusInput.parse("going")).toBe("going");
    expect(eventStatusInput.safeParse("maybe").success).toBe(false);
  });
});
