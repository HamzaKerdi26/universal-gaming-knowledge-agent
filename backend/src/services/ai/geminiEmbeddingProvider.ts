import { GoogleGenAI } from "@google/genai";
import { logger } from "../../utils/logger";
import { withAbortableTimeout, TimeoutError } from "../../utils/withTimeout";
import {
  EmbeddingProvider,
  EmbeddingProviderError,
  EmbeddingTaskType,
} from "./embeddingProvider";

const REQUEST_TIMEOUT_MS = 30_000;
// Gemini's embedContent accepts a batch of strings in one call, but we
// cap batch size defensively so one ingestion of a large document set
// can't build a single oversized request.
const BATCH_SIZE = 20;

export class GeminiEmbeddingProvider implements EmbeddingProvider {
  public readonly name = "gemini";

  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    public readonly model: string,
    public readonly dimensions: number
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async embedText(text: string, taskType?: EmbeddingTaskType): Promise<number[]> {
    const [vector] = await this.embedTexts([text], taskType);
    return vector;
  }

  async embedTexts(texts: string[], taskType?: EmbeddingTaskType): Promise<number[][]> {
    if (texts.length === 0) return [];

    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const batchVectors = await this.embedBatch(batch, taskType);
      results.push(...batchVectors);
    }
    return results;
  }

  private async embedBatch(
    texts: string[],
    taskType?: EmbeddingTaskType
  ): Promise<number[][]> {
    try {
      const response = await withAbortableTimeout(
        (abortSignal) => this.client.models.embedContent({
          model: this.model,
          contents: texts,
          config: {
            taskType,
            outputDimensionality: this.dimensions,
            abortSignal,
          },
        }),
        REQUEST_TIMEOUT_MS
      );

      const embeddings = response.embeddings;
      if (!embeddings || embeddings.length !== texts.length) {
        throw new EmbeddingProviderError(
          "The embedding provider returned an unexpected number of vectors."
        );
      }

      return embeddings.map((embedding, index) => {
        const values = embedding.values;
        if (!values || values.length === 0) {
          throw new EmbeddingProviderError(
            "The embedding provider returned an empty vector."
          );
        }
        if (values.length !== this.dimensions) {
          throw new EmbeddingProviderError(
            `Embedding dimension mismatch: expected ${this.dimensions}, got ${values.length} (item ${index}).`
          );
        }
        return values;
      });
    } catch (err) {
      if (err instanceof EmbeddingProviderError) throw err;

      logger.error("Gemini embedding request failed", {
        message: err instanceof Error ? err.message : String(err),
      });

      if (err instanceof TimeoutError) {
        throw new EmbeddingProviderError(
          "The embedding provider took too long to respond. Please try again.",
          504
        );
      }

      // Never forward the raw SDK error (could contain request details)
      // to the client — just a generic, safe message.
      throw new EmbeddingProviderError(
        "The embedding provider is currently unavailable. Please try again shortly."
      );
    }
  }
}
