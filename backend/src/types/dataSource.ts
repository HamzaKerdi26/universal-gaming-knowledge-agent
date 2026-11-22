import { z } from "zod";

export const sourceParamSchema = z.object({
  source: z.string().trim().min(1, "source is required"),
});

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, "q is required").max(200, "q is too long"),
});

export const importBodySchema = z.object({
  externalId: z.string().trim().min(1, "externalId is required"),
});
