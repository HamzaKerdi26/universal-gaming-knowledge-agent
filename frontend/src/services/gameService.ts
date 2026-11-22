import { apiClient } from "./api";
import type { ApiSuccessResponse, Game, GameInput } from "../types";

export const gameService = {
  async list(): Promise<Game[]> {
    const res = await apiClient.get<ApiSuccessResponse<Game[]>>("/games");
    return res.data.data;
  },

  async getById(id: string): Promise<Game> {
    const res = await apiClient.get<ApiSuccessResponse<Game>>(`/games/${id}`);
    return res.data.data;
  },

  async create(input: GameInput): Promise<Game> {
    const res = await apiClient.post<ApiSuccessResponse<Game>>("/games", input);
    return res.data.data;
  },

  async update(id: string, input: Partial<GameInput>): Promise<Game> {
    const res = await apiClient.put<ApiSuccessResponse<Game>>(
      `/games/${id}`,
      input
    );
    return res.data.data;
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/games/${id}`);
  },
};
