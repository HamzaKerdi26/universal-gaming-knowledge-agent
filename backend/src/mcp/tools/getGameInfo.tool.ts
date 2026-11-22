import { z } from "zod";
import { gameRepository } from "../../repositories/game.repository";
import { McpTool } from "../types";

// Looked up by slug OR title — natural-language requests ("Elden Ring")
// give a title, while a caller that already knows the internal slug can
// use that directly. At least one must be provided.
const inputSchema = z
  .object({
    slug: z.string().trim().min(1).optional(),
    title: z.string().trim().min(1).optional(),
  })
  .refine((data) => !!data.slug || !!data.title, {
    message: "Either slug or title must be provided",
  });

type GetGameInfoInput = z.infer<typeof inputSchema>;

// Phase 7's first MCP tool: structured game info straight from the
// existing PostgreSQL database, via the existing gameRepository — no new
// database query logic is introduced beyond the one small
// findByTitle() lookup added to gameRepository itself. Never invents
// data: returns exactly what's stored, or a clean not-found result.
export const getGameInfoTool: McpTool<GetGameInfoInput> = {
  name: "get_game_info",
  description:
    "Retrieves structured information about a specific game from our database, looked up by slug or title.",
  inputSchema,

  async execute(input) {
    const game = input.slug
      ? await gameRepository.findBySlug(input.slug)
      : await gameRepository.findByTitle(input.title as string);

    if (!game) {
      const identifier = input.slug ? `slug "${input.slug}"` : `title "${input.title}"`;
      return {
        success: false,
        error: `No game found matching ${identifier}.`,
      };
    }

    return {
      success: true,
      data: {
        id: game.id,
        title: game.title,
        slug: game.slug,
        description: game.description,
        releaseDate: game.releaseDate,
        developer: game.developer,
        publisher: game.publisher,
      },
    };
  },
};
