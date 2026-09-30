import { z } from "zod";

export const MAX_USER_TURNS = 6;
export const REPLY_MAX = 200;
export const QUICK_REPLY_MAX = 30;
export const QUICK_REPLIES_MAX = 4;
export const SUMMARY_MAX = 120;
export const SEARCH_TEXT_MAX = 300;

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(300),
}).strict();
export type AskChatMessage = z.infer<typeof chatMessageSchema>;

export const askChatRequestSchema = z.object({
  language: z.enum(["en", "zh"]),
  messages: z.array(chatMessageSchema).min(1).max(MAX_USER_TURNS * 2),
}).strict()
  .refine(({ messages }) => messages[messages.length - 1]?.role === "user", { message: "The thread must end with the visitor." })
  .refine(({ messages }) => messages.filter(({ role }) => role === "user").length <= MAX_USER_TURNS, { message: "Too many turns." });
export type AskChatRequest = z.infer<typeof askChatRequestSchema>;

export const askChatTurnSchema = z.object({
  reply: z.string().min(1).max(REPLY_MAX),
  quickReplies: z.array(z.string().min(1).max(QUICK_REPLY_MAX)).max(QUICK_REPLIES_MAX),
  ready: z.boolean(),
  summary: z.string().min(1).max(SUMMARY_MAX).nullable(),
  searchText: z.string().min(1).max(SEARCH_TEXT_MAX).nullable(),
}).strict();
export type AskChatTurn = z.infer<typeof askChatTurnSchema>;

export const askChatResponseSchema = askChatTurnSchema.extend({ remaining: z.number().int().min(0) });
export type AskChatResponse = z.infer<typeof askChatResponseSchema>;
