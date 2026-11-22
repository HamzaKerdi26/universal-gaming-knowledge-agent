import { Request, Response } from "express";
import { authService } from "../services/auth.service";
import { asyncHandler } from "../utils/asyncHandler";

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const data = await authService.register(req.body);
    res.status(201).json({ success: true, data });
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const data = await authService.login(req.body);
    res.status(200).json({ success: true, data });
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.getProfile(req.auth!.userId);
    res.status(200).json({ success: true, data: { user } });
  }),
};