import { ingestionPipeline } from "../rag/pipeline/ingestionPipeline";
import { chunkStore } from "../rag/store/chunkStore";
import { vectorStore } from "../rag/store/vectorStore";
import { DocumentChunk } from "../rag/types/document";
import { NotFoundError } from "../utils/AppError";
import { IngestResponseData, SearchRequestInput } from "../types/rag";
import { searchService } from "../rag/search/search.service";
import { SearchResultItem } from "../rag/search/types";
import { logger } from "../utils/logger";

export const ragService = {
  async ingest(sourcePath: string): Promise<IngestResponseData> {
    const result = await ingestionPipeline.ingest(sourcePath);

    const chunksByDocument = new Map<string, DocumentChunk[]>();
    for (const chunk of result.chunks) {
      const list = chunksByDocument.get(chunk.documentId) ?? [];
      list.push(chunk);
      chunksByDocument.set(chunk.documentId, list);
    }
    for (const [documentId, chunks] of chunksByDocument) {
      chunkStore.saveForDocument(documentId, chunks);
    }

    // Phase 5: also embed and persist the chunks in Qdrant. This is the
    // step that makes vector search possible — if it fails (no
    // GEMINI_API_KEY, Qdrant unreachable, etc.) the whole ingest request
    // fails with a clear error rather than silently skipping vector
    // storage, since a "successful" ingest that never made it into Qdrant
    // would be a confusing, hard-to-debug way to fail.
    logger.info("Starting embedding + Qdrant upsert for ingested chunks", {
      chunkCount: result.chunks.length,
    });
    await vectorStore.upsertChunks(result.chunks);

    return {
      documentsProcessed: result.documents.length,
      chunksCreated: result.chunks.length,
      documentIds: result.documents.map((d) => d.id),
    };
  },

  getChunksForDocument(documentId: string): DocumentChunk[] {
    const chunks = chunkStore.getForDocument(documentId);
    if (!chunks) {
      throw new NotFoundError(
        `No ingested chunks found for document "${documentId}". Run ingestion first.`
      );
    }
    return chunks;
  },

  async search(input: SearchRequestInput): Promise<SearchResultItem[]> {
    return searchService.search(input.query, {
      limit: input.limit,
      gameSlug: input.gameSlug,
      category: input.category,
    });
  },
};
