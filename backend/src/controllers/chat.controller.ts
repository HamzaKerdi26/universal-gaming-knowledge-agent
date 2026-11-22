import { Request, Response } from "express";
import { chatService } from "../services/chat.service";
import { asyncHandler } from "../utils/asyncHandler";

export const chatController = {
  sendMessage: asyncHandler(async (req: Request, res: Response) => {
    const data = await chatService.sendMessage(req.body, req.auth!.userId);
    res.status(200).json({ success: true, data });
  }),
};
