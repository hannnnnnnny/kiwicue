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
