import { describe, expect, it } from "vitest";
import { moodFilter } from "../lib/ask/mood";

function run(deltas: string[]) {
  const text: string[] = [];
  const moods: string[] = [];
  const filter = moodFilter((delta) => text.push(delta), (mood) => moods.push(mood));
  deltas.forEach((delta) => filter.push(delta));
  filter.flush();
  return { text: text.join(""), moods };
}

describe("moodFilter", () => {
  it("takes a mood tag out of the reply, even when it arrives in pieces", () => {
    expect(run(["[[hap", "py]] Two good ", "ones tonight."])).toEqual({ text: "Two good ones tonight.", moods: ["happy"] });
    expect(run(["[", "[sorry]]", "Nothing on Monday."])).toEqual({ text: "Nothing on Monday.", moods: ["sorry"] });
  });

  it("finds a tag at the start of a later step too", () => {
    expect(run(["Let me look. ", "[[excited]] Found three!"])).toEqual({ text: "Let me look. Found three!", moods: ["excited"] });
  });

  it("leaves ordinary brackets and unknown tags as text", () => {
    expect(run(["See [Jazz] at 7", " or [[dance]] later."])).toEqual({ text: "See [Jazz] at 7 or [[dance]] later.", moods: [] });
    expect(run(["Ends with ["])).toEqual({ text: "Ends with [", moods: [] });
    expect(run(["[[happy"])).toEqual({ text: "[[happy", moods: [] });
  });
});
