import { expect, it } from "vitest";
import { timeIntent } from "../lib/ask/time-intent";
import { budgetIntent, partySizeFrom } from "../lib/ask/budget-intent";

it("interpret time: Saturday afternoon", () => { expect(timeIntent("Saturday afternoon")).toMatchObject({"timeOfDay": "afternoon"}); });

it("interpret time: \u5468\u516d\u4e0b\u5348", () => { expect(timeIntent("\u5468\u516d\u4e0b\u5348")).toMatchObject({"timeOfDay": "afternoon"}); });

it("interpret time: morning only", () => { expect(timeIntent("morning only")).toMatchObject({"timeOfDay": "morning"}); });

it("interpret time: \u53ea\u8981\u4e0a\u5348", () => { expect(timeIntent("\u53ea\u8981\u4e0a\u5348")).toMatchObject({"timeOfDay": "morning"}); });

it("interpret time: tonight after 7 pm", () => { expect(timeIntent("tonight after 7 pm")).toMatchObject({"timeOfDay": "evening", "startMinute": 1140}); });
