import { AppError } from "../../utils/AppError";

export type ChatRole = "user" | "assistant";

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface GenerateReplyInput {
  systemPrompt: string;
  history: ChatTurn[];
  message: string;
  // Dynamically-built context for this specific query (e.g. retrieved
  // knowledge-base chunks from the agent's RAG capability, and
  // potentially other capabilities' contributions later), separate from
  // the static systemPrompt above. Built fresh per request by the caller
  // (src/agent/agent.service.ts) — never persisted as part of
  // conversation history, and never baked into the system prompt, since
  // it's only relevant to this one turn.
  context?: string;
}

export interface GenerateReplyResult {
  content: string;
  model: string;
}

// Any concrete LLM provider (Gemini, and later others) implements this.
// The rest of the app (service/controller) only ever depends on this
// interface, never on a specific SDK, so swapping providers or models
// later doesn't require touching the chat service or controller.
export interface LLMProvider {
  readonly name: string;
  generateReply(input: GenerateReplyInput): Promise<GenerateReplyResult>;
}

// Extends the project's existing AppError so it flows through the same
// centralized error-handling middleware as every other error type.
export class LLMProviderError extends AppError {
  constructor(message: string, statusCode = 502) {
    super(message, statusCode);
    Object.setPrototypeOf(this, LLMProviderError.prototype);
  }
}
