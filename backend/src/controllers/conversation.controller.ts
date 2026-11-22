import { Request, Response } from "express";
import { conversationService } from "../services/conversation.service";
import { asyncHandler } from "../utils/asyncHandler";

export const conversationController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const pagination = res.locals.validatedQuery;
    const data = await conversationService.listForUser(req.auth!.userId, pagination);
    res.status(200).json({ success: true, data });
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const conversation = await conversationService.getForUser(
      req.params.conversationId as string,
      req.auth!.userId
    );
    res.status(200).json({ success: true, data: { conversation } });
  }),

  getMessages: asyncHandler(async (req: Request, res: Response) => {
    const pagination = res.locals.validatedQuery;
    const data = await conversationService.getMessagesForUser(
      req.params.conversationId as string,
      req.auth!.userId,
      pagination
    );
    res.status(200).json({ success: true, data });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const conversation = await conversationService.createForUser(req.auth!.userId, req.body);
    res.status(201).json({ success: true, data: { conversation } });
  }),
};