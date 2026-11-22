import { z } from "zod";

export const chatRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "message is required")
    .max(4000, "message must be 4000 characters or fewer"),
  conversationId: z.string().uuid("conversationId must be a valid UUID").optional(),
});

export type ChatRequestInput = z.infer<typeof chatRequestSchema>;

export interface ChatResponseData {
  message: string;
  model: string;
  provider: string;
  conversationId: string;
}
