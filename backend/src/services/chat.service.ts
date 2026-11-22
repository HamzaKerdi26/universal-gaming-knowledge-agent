import { conversationRepository } from "../repositories/conversation.repository";
import { messageRepository } from "../repositories/message.repository";
import { ChatTurn } from "./ai/llmProvider";
import { NotFoundError } from "../utils/AppError";
import { ChatRequestInput, ChatResponseData } from "../types/chat";
import { agentService } from "../agent/agent.service";

export const chatService = {
  async sendMessage(input: ChatRequestInput, userId: string): Promise<ChatResponseData> {
    const conversation = await resolveConversation(input.conversationId, userId);

    const priorMessages = await messageRepository.findRecentByConversationId(
      conversation.id
    );
    const history: ChatTurn[] = priorMessages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // Persist the user's message before calling the agent so it isn't
    // lost if agent/LLM processing fails. Always the original message —
    // never anything RAG-augmented.
    await messageRepository.create(conversation.id, "user", input.message);

    // Phase 6: chat.service.ts stays responsible for conversation
    // persistence (this file) — deciding what information/capabilities
    // are needed and producing the reply is the agent's job. This
    // replaces Phase 5.5's inline RAG-then-LLM orchestration (RAG
    // retrieval, context building, and the LLM call all moved into
    // src/agent/), but the externally observable behavior is unchanged.
    const agentResult = await agentService.run({ message: input.message, history });

    await messageRepository.create(conversation.id, "assistant", agentResult.message);

    return {
      message: agentResult.message,
      model: agentResult.model,
      provider: agentResult.provider,
      conversationId: conversation.id,
    };
  },
};

async function resolveConversation(conversationId: string | undefined, userId: string) {
  if (!conversationId) {
    return conversationRepository.create(userId);
  }

  const existing = await conversationRepository.findByIdForUser(conversationId, userId);
  if (!existing) {
    throw new NotFoundError("Conversation not found");
  }
  return existing;
}
