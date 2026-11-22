import { GoogleGenAI } from "@google/genai";
import { logger } from "../../utils/logger";
import { withAbortableTimeout, TimeoutError } from "../../utils/withTimeout";
import {
  GenerateReplyInput,
  GenerateReplyResult,
  LLMProvider,
  LLMProviderError,
} from "./llmProvider";

// Timeout guard: the Gemini SDK does not enforce one itself, so a hung
// request would otherwise hang the whole HTTP request indefinitely.
const REQUEST_TIMEOUT_MS = 30_000;

export class GeminiProvider implements LLMProvider {
  public readonly name = "gemini";

  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  async generateReply(input: GenerateReplyInput): Promise<GenerateReplyResult> {
    // The static persona/system prompt (input.systemPrompt) is sent via
    // Gemini's systemInstruction config and never changes per-request.
    // Dynamic RAG context, when present, rides along with just this turn's
    // message instead — it's specific to this one question, not a
    // standing instruction, and doing it this way means it's never
    // accidentally persisted into conversation history either (the
    // caller only stores input.message, not this combined text).
    const finalMessageText = input.context
      ? `${input.context}\n\nUSER QUESTION:\n${input.message}`
      : input.message;

    const contents = [
      ...input.history.map((turn) => ({
        role: turn.role === "assistant" ? "model" : "user",
        parts: [{ text: turn.content }],
      })),
      { role: "user", parts: [{ text: finalMessageText }] },
    ];

    try {
      const response = await withAbortableTimeout(
        (abortSignal) => this.client.models.generateContent({
          model: this.model,
          contents,
          config: {
            systemInstruction: input.systemPrompt,
            abortSignal,
          },
        }),
        REQUEST_TIMEOUT_MS
      );

      const text = response.text;
      if (!text) {
        throw new LLMProviderError(
          "The AI provider returned an empty response."
        );
      }

      return { content: text, model: this.model };
    } catch (err) {
      if (err instanceof LLMProviderError) throw err;

      logger.error("Gemini provider request failed", {
        message: err instanceof Error ? err.message : String(err),
      });

      if (err instanceof TimeoutError) {
        throw new LLMProviderError(
          "The AI provider took too long to respond. Please try again.",
          504
        );
      }

      // Never forward the raw SDK error (could contain request details)
      // to the client — just a generic, safe message.
      throw new LLMProviderError(
        "The AI provider is currently unavailable. Please try again shortly."
      );
    }
  }
}
