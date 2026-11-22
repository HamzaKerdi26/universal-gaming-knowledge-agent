import { Request, Response } from "express";
import { dataSourceService } from "../services/dataSource.service";
import { asyncHandler } from "../utils/asyncHandler";

export const dataSourceController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    res.status(200).json({ success: true, data: { sources: dataSourceService.listSources() } });
  }),

  search: asyncHandler(async (req: Request, res: Response) => {
    const source = req.params.source as string;
    const query = (res.locals.validatedQuery as { q: string }).q;
    const results = await dataSourceService.search(source, query);
    res.status(200).json({ success: true, data: { results } });
  }),

  import: asyncHandler(async (req: Request, res: Response) => {
    const source = req.params.source as string;
    const result = await dataSourceService.importRecord(source, req.body.externalId);
    res.status(200).json({ success: true, data: result });
  }),
};
