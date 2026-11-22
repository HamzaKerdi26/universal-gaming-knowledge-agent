import { DocumentChunk } from "../types/document";

// Phase 4 storage decision: an in-memory cache, not a new Prisma table.
//
// Why: the only consumer of stored chunks right now is the preview
// endpoint (GET /api/rag/documents/:documentId/chunks), used for manually
// inspecting ingestion output before Phase 5 exists. Persisting that to
// Postgres would mean adding Document/Chunk tables purely to support a
// temporary preview UI, then likely reshaping or discarding them once
// Phase 5 introduces Qdrant as the real chunk/embedding store. An
// in-memory cache avoids that churn — it's replaced, not migrated, when
// Phase 5 lands.
//
// Trade-off, stated plainly: this cache is per-process and does not
// survive a server restart. Re-run ingestion after a restart to
// repopulate it. That's an acceptable limitation for a Phase 4 preview
// tool; it would not be acceptable for Phase 5's real retrieval path,
// which is exactly why Phase 5 needs Qdrant rather than reusing this.
const chunksByDocumentId = new Map<string, DocumentChunk[]>();

export const chunkStore = {
  saveForDocument(documentId: string, chunks: DocumentChunk[]): void {
    chunksByDocumentId.set(documentId, chunks);
  },

  getForDocument(documentId: string): DocumentChunk[] | undefined {
    return chunksByDocumentId.get(documentId);
  },

  listDocumentIds(): string[] {
    return Array.from(chunksByDocumentId.keys());
  },

  clear(): void {
    chunksByDocumentId.clear();
  },
};
