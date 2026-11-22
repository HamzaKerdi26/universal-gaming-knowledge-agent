import { z } from "zod";

export const conversationIdParamSchema = z.object({
  conversationId: z.string().uuid("conversationId must be a valid UUID"),
});

export const createConversationSchema = z.object({
  title: z.string().trim().max(200).optional(),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginationMetadata {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

export function paginationMetadata(page: number, limit: number, totalCount: number): PaginationMetadata {
  return { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) };
}