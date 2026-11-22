import { Request, Response } from "express";
import { gameService } from "../services/game.service";
import { asyncHandler } from "../utils/asyncHandler";

export const gameController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    const games = await gameService.listGames();
    res.status(200).json({ success: true, data: games });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const game = await gameService.getGameById(req.params.id as string);
    res.status(200).json({ success: true, data: game });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const game = await gameService.createGame(req.body);
    res.status(201).json({ success: true, data: game });
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const game = await gameService.updateGame(req.params.id as string, req.body);
    res.status(200).json({ success: true, data: game });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await gameService.deleteGame(req.params.id as string);
    res.status(204).send();
  }),
};
