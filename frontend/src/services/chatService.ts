import { apiClient } from "./api";
import type { ApiSuccessResponse, ChatRequestInput, ChatResponseData } from "../types";

export const chatService = {
  async sendMessage(input: ChatRequestInput): Promise<ChatResponseData> {
    const res = await apiClient.post<ApiSuccessResponse<ChatResponseData>>(
      "/chat",
      input
    );
    return res.data.data;
  },
};
