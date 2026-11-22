import { Conversation, Message } from "@prisma/client";
import { conversationRepository } from "../repositories/conversation.repository";
import { messageRepository } from "../repositories/message.repository";
import {
  CreateConversationInput,
  PaginationQuery,
  paginationMetadata,
} from "../types/conversation";
import { NotFoundError } from "../utils/AppError";

export const conversationService = {
  async listForUser(userId: string, pagination: PaginationQuery) {
    const result = await conversationRepository.findPageForUser(
      userId,
      pagination.page,
      pagination.limit
    );
    return {
      conversations: result.items,
      pagination: paginationMetadata(pagination.page, pagination.limit, result.totalCount),
    };
  },

  async getForUser(conversationId: string, userId: string): Promise<Conversation> {
    const conversation = await conversationRepository.findByIdForUser(conversationId, userId);
    if (!conversation) throw new NotFoundError("Conversation not found");
    return conversation;
  },

  async getMessagesForUser(
    conversationId: string,
    userId: string,
    pagination: PaginationQuery
  ) {
    await conversationService.getForUser(conversationId, userId);
    const result = await messageRepository.findPageByConversationId(
      conversationId,
      pagination.page,
      pagination.limit
    );
    return {
      messages: result.items,
      pagination: paginationMetadata(pagination.page, pagination.limit, result.totalCount),
    };
  },

  createForUser(userId: string, input: CreateConversationInput): Promise<Conversation> {
    return conversationRepository.create(userId, input.title);
  },
};