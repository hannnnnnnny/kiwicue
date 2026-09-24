import { z } from "zod";
import { eventIdInput } from "./validation";

export const activityInput = z.object({
  action: z.enum(["event_view", "event_save", "event_unsave", "event_interested",
    "event_going", "event_went", "event_share", "event_comment", "event_like", "event_ticket_click"]),
  eventId: eventIdInput,
}).strict();
export type ActivityInput = z.infer<typeof activityInput>;

export async function trackActivity(input: ActivityInput): Promise<boolean> {
  if (!activityInput.safeParse(input).success) return false;
  try {
    const response = await fetch("/api/me/activity", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input), cache: "no-store", keepalive: true,
    });
    return response.ok;
  } catch { return false; }
}
