import { Game } from "@prisma/client";
import { gameRepository } from "../repositories/game.repository";
import { ConflictError, NotFoundError } from "../utils/AppError";
import { CreateGameInput, UpdateGameInput } from "../types/game";

export const gameService = {
  async listGames(): Promise<Game[]> {
    return gameRepository.findAll();
  },

  async getGameById(id: string): Promise<Game> {
    const game = await gameRepository.findById(id);
    if (!game) {
      throw new NotFoundError(`Game with id "${id}" not found`);
    }
    return game;
  },

  async createGame(input: CreateGameInput): Promise<Game> {
    const existing = await gameRepository.findBySlug(input.slug);
    if (existing) {
      throw new ConflictError(`A game with slug "${input.slug}" already exists`);
    }
    return gameRepository.create({
      title: input.title,
      slug: input.slug,
      description: input.description,
      releaseDate: input.releaseDate ? new Date(input.releaseDate) : undefined,
      developer: input.developer,
      publisher: input.publisher,
    });
  },

  async updateGame(id: string, input: UpdateGameInput): Promise<Game> {
    await gameService.getGameById(id); // ensures 404 if missing

    if (input.slug) {
      const existing = await gameRepository.findBySlug(input.slug);
      if (existing && existing.id !== id) {
        throw new ConflictError(`A game with slug "${input.slug}" already exists`);
      }
    }

    return gameRepository.update(id, {
      ...input,
      releaseDate: input.releaseDate ? new Date(input.releaseDate) : undefined,
    });
  },

  async deleteGame(id: string): Promise<void> {
    await gameService.getGameById(id); // ensures 404 if missing
    await gameRepository.remove(id);
  },
};
