import { expect, it } from "vitest";
import { timeIntent } from "../lib/ask/time-intent";
import { budgetIntent, partySizeFrom } from "../lib/ask/budget-intent";

it("interpret time: Saturday afternoon", () => { expect(timeIntent("Saturday afternoon")).toMatchObject({"timeOfDay": "afternoon"}); });
