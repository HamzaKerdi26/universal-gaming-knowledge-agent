export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
  failed?: boolean;
}

export interface ChatRequestInput {
  message: string;
  conversationId?: string;
}

export interface ChatResponseData {
  message: string;
  model: string;
  provider: string;
  conversationId: string;
}
