import { z } from "zod";

export const ingestRequestSchema = z.object({
  path: z.string().trim().min(1, "path is required"),
});

export type IngestRequestInput = z.infer<typeof ingestRequestSchema>;

export const documentIdParamSchema = z.object({
  documentId: z.string().trim().min(1, "documentId is required"),
});

export interface IngestResponseData {
  documentsProcessed: number;
  chunksCreated: number;
  documentIds: string[];
}

export const searchRequestSchema = z.object({
  query: z.string().trim().min(1, "query is required").max(1000, "query is too long"),
  limit: z.number().int().min(1).max(50).optional(),
  gameSlug: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
});

export type SearchRequestInput = z.infer<typeof searchRequestSchema>;
