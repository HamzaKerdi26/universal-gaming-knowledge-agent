import { env } from "../../config/env";
import { GeminiProvider } from "./geminiProvider";
import { LLMProvider, LLMProviderError } from "./llmProvider";
import { GeminiEmbeddingProvider } from "./geminiEmbeddingProvider";
import { EmbeddingProvider, EmbeddingProviderError } from "./embeddingProvider";

let cachedProvider: LLMProvider | null = null;
let cachedEmbeddingProvider: EmbeddingProvider | null = null;

// Lazily constructs (and caches) the configured LLMProvider. Lazy so that
// a missing GEMINI_API_KEY doesn't crash the whole server on startup —
// it only surfaces as an error when someone actually calls the chat
// endpoint, matching how the rest of the app handles missing config.
export function getLLMProvider(): LLMProvider {
  if (cachedProvider) return cachedProvider;

  switch (env.ai.provider) {
    case "gemini": {
      if (!env.ai.geminiApiKey) {
        throw new LLMProviderError(
          "AI chat is not configured on this server (missing GEMINI_API_KEY).",
          503
        );
      }
      cachedProvider = new GeminiProvider(env.ai.geminiApiKey, env.ai.geminiModel);
      return cachedProvider;
    }
    default:
      throw new LLMProviderError(
        `Unsupported AI provider configured: "${env.ai.provider}"`,
        500
      );
  }
}

// Exposed for tests so they can inject a fake provider instead of hitting
// the real Gemini API.
export function setLLMProviderForTesting(provider: LLMProvider | null): void {
  cachedProvider = provider;
}

// Same lazy-caching pattern as getLLMProvider, for the separate
// embedding provider (Phase 5). Deliberately its own cache/config path —
// embedding and chat are different responsibilities and may end up on
// different providers or models even though both currently default to
// "gemini".
export function getEmbeddingProvider(): EmbeddingProvider {
  if (cachedEmbeddingProvider) return cachedEmbeddingProvider;

  switch (env.embedding.provider) {
    case "gemini": {
      if (!env.ai.geminiApiKey) {
        throw new EmbeddingProviderError(
          "Embeddings are not configured on this server (missing GEMINI_API_KEY).",
          503
        );
      }
      cachedEmbeddingProvider = new GeminiEmbeddingProvider(
        env.ai.geminiApiKey,
        env.embedding.geminiModel,
        env.embedding.dimensions
      );
      return cachedEmbeddingProvider;
    }
    default:
      throw new EmbeddingProviderError(
        `Unsupported embedding provider configured: "${env.embedding.provider}"`,
        500
      );
  }
}

export function setEmbeddingProviderForTesting(provider: EmbeddingProvider | null): void {
  cachedEmbeddingProvider = provider;
}
