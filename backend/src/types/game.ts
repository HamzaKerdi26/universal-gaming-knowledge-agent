import { z } from "zod";

export const createGameSchema = z.object({
  title: z.string().min(1, "title is required").max(200),
  slug: z
    .string()
    .min(1, "slug is required")
    .max(200)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug must be lowercase, alphanumeric, hyphen-separated"),
  description: z.string().max(5000).optional(),
  releaseDate: z.string().datetime().optional(),
  developer: z.string().max(200).optional(),
  publisher: z.string().max(200).optional(),
});

export const updateGameSchema = createGameSchema.partial();

export const gameIdParamSchema = z.object({
  id: z.string().uuid("id must be a valid UUID"),
});

export type CreateGameInput = z.infer<typeof createGameSchema>;
export type UpdateGameInput = z.infer<typeof updateGameSchema>;
