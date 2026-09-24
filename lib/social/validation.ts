import { z } from "zod";

export const usernameInput = z.string().trim().toLowerCase()
  .min(3).max(30).regex(/^[a-z0-9_]+$/);

export const eventIdInput = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
export const eventStatusInput = z.enum(["interested", "going", "went"]);

export const profileInput = z.object({
  username: usernameInput,
  displayName: z.string().trim().min(1).max(100),
  bio: z.string().trim().max(500).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  isPublic: z.boolean().optional(),
}).strict();

export const collectionInput = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).nullable().optional(),
  isPublic: z.boolean().optional(),
}).strict();

export const commentInput = z.object({
  content: z.string().trim().min(1).max(1_000),
}).strict();

export const emailInput = z.email().max(254);
export const passwordInput = z.string().min(8).max(128);

export const authInput = z.object({
  email: emailInput,
  password: passwordInput,
}).strict();
