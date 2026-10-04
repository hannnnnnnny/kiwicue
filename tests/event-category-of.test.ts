import { expect, it } from "vitest";
import { categoryOfEvent } from "../lib/event-categories";

it("files an event under the browse category it belongs to", () => {
  expect(categoryOfEvent({ category: "Music" }, false)).toBe("concerts");
  expect(categoryOfEvent({ category: "Arts & Theatre" }, false)).toBe("theatre");
  expect(categoryOfEvent({ category: "Anything" }, true)).toBe("markets");
  expect(categoryOfEvent({ category: "Miscellaneous" }, false)).toBeNull();
  expect(categoryOfEvent({ category: null }, false)).toBeNull();
});
