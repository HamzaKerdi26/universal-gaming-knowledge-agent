import { Conversation } from "@prisma/client";
import { prisma } from "../config/prisma";

export const conversationRepository = {
  async findPageForUser(
    userId: string,
    page: number,
    limit: number
  ): Promise<{ items: Conversation[]; totalCount: number }> {
    const where = { userId };
    const [items, totalCount] = await prisma.$transaction([
      prisma.conversation.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.conversation.count({ where }),
    ]);
    return { items, totalCount };
  },

  findByIdForUser(id: string, userId: string): Promise<Conversation | null> {
    return prisma.conversation.findFirst({ where: { id, userId } });
  },

  create(userId: string, title?: string): Promise<Conversation> {
    return prisma.conversation.create({ data: { userId, title } });
  },
};
