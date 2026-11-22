import { DocumentMetadata } from "../types/document";

// The payload stored alongside each vector in Qdrant. Extends the Phase 4
// DocumentMetadata with the chunk-specific fields needed to reconstruct a
// useful search result without a second lookup — Qdrant is the only
// place this data lives (see the store/vectorStore.ts module doc).
export interface ChunkPayload extends DocumentMetadata {
  chunkId: string;
  documentId: string;
  content: string;
  chunkIndex: number;
}

export interface VectorPoint {
  id: string; // deterministic UUID v5 — see pointId.ts
  vector: number[];
  payload: ChunkPayload;
}

export interface VectorSearchFilter {
  gameSlug?: string;
  category?: string;
}

export interface VectorSearchOptions extends VectorSearchFilter {
  limit?: number;
}

export interface VectorSearchMatch {
  id: string;
  score: number;
  payload: ChunkPayload;
}
