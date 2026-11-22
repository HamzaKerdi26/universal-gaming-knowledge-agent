import { Request, Response } from "express";
import { ragService } from "../services/rag.service";
import { asyncHandler } from "../utils/asyncHandler";

export const ragController = {
  ingest: asyncHandler(async (req: Request, res: Response) => {
    const result = await ragService.ingest(req.body.path);
    res.status(200).json({ success: true, data: result });
  }),

  getChunks: asyncHandler(async (req: Request, res: Response) => {
    const documentId = req.params.documentId as string;
    const chunks = ragService.getChunksForDocument(documentId);
    res.status(200).json({
      success: true,
      data: { documentId, chunkCount: chunks.length, chunks },
    });
  }),

  search: asyncHandler(async (req: Request, res: Response) => {
    const results = await ragService.search(req.body);
    res.status(200).json({ success: true, data: { results } });
  }),
};
