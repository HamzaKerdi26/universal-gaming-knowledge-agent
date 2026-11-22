import { z } from "zod";

export const registerRequestSchema = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  username: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(128),
});

export const loginRequestSchema = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export interface SafeUser {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthIdentity {
  userId: string;
}

export interface AuthResponse {
  user: SafeUser;
  token: string;
}