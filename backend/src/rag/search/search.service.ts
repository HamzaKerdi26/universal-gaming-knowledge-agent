import { vectorStore } from "../store/vectorStore";
import { getEmbeddingProvider } from "../../services/ai";
import { SearchOptions, SearchResultItem } from "./types";

const DEFAULT_LIMIT = 5;

// Turns a natural-language query into an embedding, searches Qdrant for
// similar chunks, and returns a flattened, API-friendly result shape.
// Deliberately just retrieval — it does not call the LLM or build a
// prompt. Wiring retrieval into the chat flow is a later phase.
export const searchService = {
  async search(query: string, options: SearchOptions = {}): Promise<SearchResultItem[]> {
    const provider = getEmbeddingProvider();
    const queryVector = await provider.embedText(query, "RETRIEVAL_QUERY");

    const matches = await vectorStore.search(queryVector, {
      limit: options.limit ?? DEFAULT_LIMIT,
      gameSlug: options.gameSlug,
      category: options.category,
    });

    return matches.map((match) => ({
      score: match.score,
      chunkId: match.payload.chunkId,
      documentId: match.payload.documentId,
      gameSlug: match.payload.gameSlug,
      category: match.payload.category,
      title: match.payload.title,
      content: match.payload.content,
      chunkIndex: match.payload.chunkIndex,
    }));
  },
};

export const DEFAULT_SEARCH_LIMIT = DEFAULT_LIMIT;
