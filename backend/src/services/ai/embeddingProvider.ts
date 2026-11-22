import { AppError } from "../../utils/AppError";

// Which stage of retrieval this embedding is for. Gemini's embedding
// model uses this to produce better vectors for each side of a
// similarity search — a document being indexed and a query searching for
// it are embedded slightly differently even though both end up as plain
// number[] vectors.
export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

// Any concrete embedding provider (Gemini, and later others) implements
// this. The rest of the app (vector store, search service) only ever
// depends on this interface, never on a specific SDK — deliberately
// separate from LLMProvider (src/services/ai/llmProvider.ts), since
// embedding and text generation are different responsibilities that can
// use entirely different models or even different providers.
export interface EmbeddingProvider {
  readonly name: string;
  readonly model: string;
  // The fixed length of every vector this provider returns. Qdrant's
  // collection is created with this exact size — never guessed.
  readonly dimensions: number;

  embedText(text: string, taskType?: EmbeddingTaskType): Promise<number[]>;
  embedTexts(texts: string[], taskType?: EmbeddingTaskType): Promise<number[][]>;
}

// Extends the project's existing AppError so it flows through the same
// centralized error-handling middleware as every other error type.
export class EmbeddingProviderError extends AppError {
  constructor(message: string, statusCode = 502) {
    super(message, statusCode);
    Object.setPrototypeOf(this, EmbeddingProviderError.prototype);
  }
}
