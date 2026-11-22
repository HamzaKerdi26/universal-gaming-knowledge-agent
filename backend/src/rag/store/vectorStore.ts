import { DocumentChunk } from "../types/document";
import { getEmbeddingProvider } from "../../services/ai";
import { EmbeddingProviderError } from "../../services/ai/embeddingProvider";
import { qdrantService } from "../vector/qdrantService";
import { deterministicPointId } from "../vector/pointId";
import { ChunkPayload, VectorPoint, VectorSearchMatch, VectorSearchOptions } from "../vector/types";
import { logger } from "../../utils/logger";

// The persistent counterpart to chunkStore.ts (Phase 4's temporary
// in-memory cache). Converts DocumentChunks into embeddings and Qdrant
// points, and exposes the operations the rest of the RAG system needs —
// upsert, search, delete — without any caller needing to know Qdrant is
// underneath. Both stores are kept: chunkStore still backs the Phase 4
// preview endpoint; vectorStore backs real persistence and search. See
// the README's "Two stores" note for why both exist.
export const vectorStore = {
  async upsertChunks(chunks: DocumentChunk[]): Promise<void> {
    if (chunks.length === 0) return;

    const provider = getEmbeddingProvider();
    await qdrantService.ensureCollection(provider.dimensions);

    logger.info("Embedding generation started", { chunkCount: chunks.length });
    const vectors = await provider.embedTexts(
      chunks.map((c) => c.content),
      "RETRIEVAL_DOCUMENT"
    );
    logger.info("Embedding generation completed", { chunkCount: chunks.length });

    const points: VectorPoint[] = chunks.map((chunk, index) => {
      const vector = vectors[index];
      if (vector.length !== provider.dimensions) {
        throw new EmbeddingProviderError(
          `Embedding dimension mismatch for chunk "${chunk.id}": expected ${provider.dimensions}, got ${vector.length}.`
        );
      }

      const payload: ChunkPayload = {
        ...chunk.metadata,
        chunkId: chunk.id,
        documentId: chunk.documentId,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
      };

      return {
        id: deterministicPointId(chunk.documentId, chunk.chunkIndex),
        vector,
        payload,
      };
    });

    await qdrantService.upsertPoints(points);
  },

  async deleteDocumentChunks(documentId: string): Promise<void> {
    await qdrantService.deletePointsByDocumentId(documentId);
  },

  async search(
    queryVector: number[],
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchMatch[]> {
    return qdrantService.searchPoints(queryVector, options);
  },
};
