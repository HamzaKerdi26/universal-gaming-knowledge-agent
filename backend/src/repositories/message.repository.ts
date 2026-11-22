import { Message, MessageRole } from "@prisma/client";
import { prisma } from "../config/prisma";

// Keep a bounded amount of history sent back to the LLM so requests
// don't grow unbounded as a conversation gets long. Real memory/retrieval
// strategies are a later phase — this is intentionally simple for now.
const MAX_HISTORY_MESSAGES = 20;

export const messageRepository = {
  async findPageByConversationId(
    conversationId: string,
    page: number,
    limit: number
  ): Promise<{ items: Message[]; totalCount: number }> {
    const where = { conversationId };
    const [items, totalCount] = await prisma.$transaction([
      prisma.message.findMany({
        where,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.message.count({ where }),
    ]);
    return { items, totalCount };
  },

  findRecentByConversationId(conversationId: string): Promise<Message[]> {
    return prisma.message
      .findMany({
        where: { conversationId },
        orderBy: { createdAt: "desc" },
        take: MAX_HISTORY_MESSAGES,
      })
      .then((messages: Message[]) => messages.reverse());
  },

  create(conversationId: string, role: MessageRole, content: string): Promise<Message> {
    return prisma.$transaction(async (transaction) => {
      const message = await transaction.message.create({
        data: { conversationId, role, content },
      });
      await transaction.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
      return message;
    });
  },
};
