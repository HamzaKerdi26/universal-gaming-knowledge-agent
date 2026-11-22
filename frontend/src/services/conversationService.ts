import { apiClient } from "./api";
import type { ApiSuccessResponse } from "../types/game";
import type { Conversation, ConversationMessage } from "../types/conversation";

export const conversationService = {
  async list(): Promise<Conversation[]> {
    const response = await apiClient.get<ApiSuccessResponse<{ conversations: Conversation[] }>>(
      "/conversations"
    );
    return response.data.data.conversations;
  },

  async getById(conversationId: string): Promise<Conversation> {
    const response = await apiClient.get<ApiSuccessResponse<{ conversation: Conversation }>>(
      `/conversations/${conversationId}`
    );
    return response.data.data.conversation;
  },

  async getMessages(conversationId: string): Promise<ConversationMessage[]> {
    const response = await apiClient.get<ApiSuccessResponse<{ messages: ConversationMessage[] }>>(
      `/conversations/${conversationId}/messages`
    );
    return response.data.data.messages;
  },

  async create(title?: string): Promise<Conversation> {
    const response = await apiClient.post<ApiSuccessResponse<{ conversation: Conversation }>>(
      "/conversations",
      title ? { title } : {}
    );
    return response.data.data.conversation;
  },
};