import { expect, it } from "vitest";
import { timeIntent } from "../lib/ask/time-intent";
import { budgetIntent, partySizeFrom } from "../lib/ask/budget-intent";

it("interpret time: Saturday afternoon", () => { expect(timeIntent("Saturday afternoon")).toMatchObject({"timeOfDay": "afternoon"}); });

it("interpret time: \u5468\u516d\u4e0b\u5348", () => { expect(timeIntent("\u5468\u516d\u4e0b\u5348")).toMatchObject({"timeOfDay": "afternoon"}); });

it("interpret time: morning only", () => { expect(timeIntent("morning only")).toMatchObject({"timeOfDay": "morning"}); });

it("interpret time: \u53ea\u8981\u4e0a\u5348", () => { expect(timeIntent("\u53ea\u8981\u4e0a\u5348")).toMatchObject({"timeOfDay": "morning"}); });

it("interpret time: tonight after 7 pm", () => { expect(timeIntent("tonight after 7 pm")).toMatchObject({"timeOfDay": "evening", "startMinute": 1140}); });

it("interpret time: \u4eca\u665a\u665a\u4e0a7\u70b9\u4e4b\u540e", () => { expect(timeIntent("\u4eca\u665a\u665a\u4e0a7\u70b9\u4e4b\u540e")).toMatchObject({"timeOfDay": "evening", "startMinute": 1140}); });

it("interpret time: after 7:30 pm", () => { expect(timeIntent("after 7:30 pm")).toMatchObject({"startMinute": 1170}); });

it("interpret time: \u665a\u4e0a7\u70b930\u4e4b\u540e", () => { expect(timeIntent("\u665a\u4e0a7\u70b930\u4e4b\u540e")).toMatchObject({"startMinute": 1170}); });

it("interpret time: before 3 pm", () => { expect(timeIntent("before 3 pm")).toMatchObject({"endMinute": 900}); });

it("interpret time: \u4e0b\u53483\u70b9\u4e4b\u524d", () => { expect(timeIntent("\u4e0b\u53483\u70b9\u4e4b\u524d")).toMatchObject({"endMinute": 900}); });

it("interpret time: after 12 am", () => { expect(timeIntent("after 12 am")).toMatchObject({"startMinute": 0}); });

it("interpret time: after 12 pm", () => { expect(timeIntent("after 12 pm")).toMatchObject({"startMinute": 720}); });

it("interpret time: any time", () => { expect(timeIntent("any time")).toMatchObject({"timeOfDay": "any", "startMinute": null, "endMinute": null}); });

it("interpret time: \u4e0d\u9650\u65f6\u95f4", () => { expect(timeIntent("\u4e0d\u9650\u65f6\u95f4")).toMatchObject({"timeOfDay": "any", "startMinute": null, "endMinute": null}); });

it("ignore invalid or unmentioned clock: before 25:00", () => { expect(timeIntent("before 25:00").startMinute).toBeUndefined(); expect(timeIntent("before 25:00").endMinute).toBeUndefined(); });

it("ignore invalid or unmentioned clock: after 8:99 pm", () => { expect(timeIntent("after 8:99 pm").startMinute).toBeUndefined(); expect(timeIntent("after 8:99 pm").endMinute).toBeUndefined(); });

it("ignore invalid or unmentioned clock: after 19 pm", () => { expect(timeIntent("after 19 pm").startMinute).toBeUndefined(); expect(timeIntent("after 19 pm").endMinute).toBeUndefined(); });

it("ignore invalid or unmentioned clock: thanks", () => { expect(timeIntent("thanks").startMinute).toBeUndefined(); expect(timeIntent("thanks").endMinute).toBeUndefined(); });

it("count party: two adults and a 6-year-old", () => { expect(partySizeFrom("two adults and a 6-year-old")).toBe(3); });

it("count party: 2 adults and 2 children", () => { expect(partySizeFrom("2 adults and 2 children")).toBe(4); });

it("count party: \u4e24\u5927\u4e00\u5c0f", () => { expect(partySizeFrom("\u4e24\u5927\u4e00\u5c0f")).toBe(3); });

it("count party: \u4e09\u4e2a\u4eba", () => { expect(partySizeFrom("\u4e09\u4e2a\u4eba")).toBe(3); });

it("count party: for all three people", () => { expect(partySizeFrom("for all three people")).toBe(3); });

it("count party: party of 5", () => { expect(partySizeFrom("party of 5")).toBe(5); });

it("count party: 2\u59272\u5c0f", () => { expect(partySizeFrom("2\u59272\u5c0f")).toBe(4); });

it("count party: four adults", () => { expect(partySizeFrom("four adults")).toBe(4); });

it("count party: for 30 people", () => { expect(partySizeFrom("for 30 people")).toBe(30); });

it("count party: for 31 people", () => { expect(partySizeFrom("for 31 people")).toBe(undefined); });

it("interpret budget: total budget under NZ$60", () => { expect(budgetIntent("total budget under NZ$60")).toMatchObject({"totalBudget": 60, "maxPrice": null}); });

it("interpret budget: \u603b\u9884\u7b9760\u5143", () => { expect(budgetIntent("\u603b\u9884\u7b9760\u5143")).toMatchObject({"totalBudget": 60, "maxPrice": null}); });

it("interpret budget: NZD 120 combined", () => { expect(budgetIntent("NZD 120 combined")).toMatchObject({"totalBudget": 120}); });

it("interpret budget: $45 per ticket", () => { expect(budgetIntent("$45 per ticket")).toMatchObject({"maxPrice": 45, "totalBudget": null}); });

it("interpret budget: \u6bcf\u4eba30\u5143", () => { expect(budgetIntent("\u6bcf\u4eba30\u5143")).toMatchObject({"maxPrice": 30}); });

it("interpret budget: $25 each", () => { expect(budgetIntent("$25 each")).toMatchObject({"maxPrice": 25}); });

it("interpret budget: no budget limit", () => { expect(budgetIntent("no budget limit")).toMatchObject({"maxPrice": null, "totalBudget": null}); });

it("interpret budget: \u9884\u7b97\u4e0d\u9650", () => { expect(budgetIntent("\u9884\u7b97\u4e0d\u9650")).toMatchObject({"maxPrice": null, "totalBudget": null}); });

it("interpret budget: total $0", () => { expect(budgetIntent("total $0")).toMatchObject({"totalBudget": 0}); });
