import { Router } from "express";
import { healthRouter } from "./health.routes";
import { gameRouter } from "./game.routes";
import { chatRouter } from "./chat.routes";
import { ragRouter } from "./rag.routes";
import { dataSourceRouter } from "./dataSource.routes";
import { authRouter } from "./auth.routes";
import { conversationRouter } from "./conversation.routes";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/conversations", conversationRouter);
apiRouter.use("/games", gameRouter);
apiRouter.use("/chat", chatRouter);
apiRouter.use("/rag", ragRouter);
apiRouter.use("/sources", dataSourceRouter);
