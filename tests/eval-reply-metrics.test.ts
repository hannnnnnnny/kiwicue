import { describe, expect, it } from "vitest";
import { measure } from "../evals/replies/metrics";

describe("reply metrics", () => {
  it("spots a catalogue reply: many titles, read-out times, a price caveat and a menu question", () => {
    const reply = "Saturday the 10th has a few good ones. Noah Kahan at Spark Arena, 6:30pm. Otherwise Cabaret at 2pm and Aaron Chen at 8pm. Prices aren't listed for any of these, so check the event pages. What kind of thing are you after — music, comedy, or something to wander around?";
    expect(measure(reply, ["Noah Kahan - The Great Divide Tour", "Cabaret - NZSL-Interpreted", "Aaron Chen - Technology", "Eatropolis"])).toMatchObject({
      titlesNamed: 3, timesRead: 3, priceCaveat: true, endsWithQuestion: true, menuQuestion: true,
    });
  });

  it("flags a reply in the wrong language", () => {
    expect(measure("Devonport 今晚没有爵士乐。", [], "en").wrongLanguage).toBe(true);
    expect(measure("Nothing in Devonport tonight.", [], "en").wrongLanguage).toBe(false);
  });

  it("passes a short, opinionated reply", () => {
    const metrics = measure("I'd go to Noah Kahan — it's the big night out of the weekend, and Spark Arena is easy to get to.", ["Noah Kahan - The Great Divide Tour", "Cabaret"]);
    expect(metrics).toMatchObject({ titlesNamed: 1, timesRead: 0, priceCaveat: false, endsWithQuestion: false, menuQuestion: false });
    expect(metrics.length).toBeLessThan(25);
  });

  it("measures Chinese by characters and spots its caveats", () => {
    const metrics = measure("周六上午10点的 Wonderverse 最合适。票价还没查到，出发前再确认一下。想看室内还是户外？", ["Wonderverse"]);
    expect(metrics).toMatchObject({ titlesNamed: 1, priceCaveat: true, endsWithQuestion: true, menuQuestion: true });
    expect(metrics.timesRead).toBe(1);
  });
});
