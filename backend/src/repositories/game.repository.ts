import { Game, Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";

export const gameRepository = {
  findAll(): Promise<Game[]> {
    return prisma.game.findMany({ orderBy: { createdAt: "desc" } });
  },

  findById(id: string): Promise<Game | null> {
    return prisma.game.findUnique({ where: { id } });
  },

  findBySlug(slug: string): Promise<Game | null> {
    return prisma.game.findUnique({ where: { slug } });
  },

  // Case-insensitive title lookup, added for Phase 7's get_game_info MCP
  // tool — users naturally refer to a game by name ("Elden Ring"), not
  // by its internal slug. Read-only, uses the existing @@index([title]),
  // no different from the other lookup methods already here.
  findByTitle(title: string): Promise<Game | null> {
    return prisma.game.findFirst({
      where: { title: { equals: title, mode: "insensitive" } },
    });
  },

  create(data: Prisma.GameCreateInput): Promise<Game> {
    return prisma.game.create({ data });
  },

  update(id: string, data: Prisma.GameUpdateInput): Promise<Game> {
    return prisma.game.update({ where: { id }, data });
  },

  remove(id: string): Promise<Game> {
    return prisma.game.delete({ where: { id } });
  },
};
