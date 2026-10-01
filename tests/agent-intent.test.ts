import { expect, it } from "vitest";
import { timeIntent } from "../lib/ask/time-intent";
import { budgetIntent, partySizeFrom } from "../lib/ask/budget-intent";

it("interpret time: Saturday afternoon", () => { expect(timeIntent("Saturday afternoon")).toMatchObject({"timeOfDay": "afternoon"}); });

it("interpret time: \u5468\u516d\u4e0b\u5348", () => { expect(timeIntent("\u5468\u516d\u4e0b\u5348")).toMatchObject({"timeOfDay": "afternoon"}); });
