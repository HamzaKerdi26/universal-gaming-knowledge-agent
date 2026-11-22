// Core type definitions for the RAG ingestion pipeline. These describe a
// document's shape at each stage: as loaded (RawDocument), after cleaning
// (ProcessedDocument), and after splitting for embedding (DocumentChunk).
//
// Kept independent of Qdrant/embeddings on purpose — Phase 5 will consume
// DocumentChunk[] to produce embeddings and Qdrant points, but nothing in
// this file (or the rest of src/rag/) knows anything about vectors.

export type SourceType = "file" | "web" | "manual";

// Extensible metadata bag. gameSlug/title/source/sourceType/documentId are
// always present (enforced by the pipeline's metadata-extraction step);
// anything else (category, tags, patch version, etc.) can be added by a
// loader or a future processor without changing this interface.
export interface DocumentMetadata {
  documentId: string;
  title: string;
  source: string;
  sourceType: string;
  gameSlug: string;
  category?: string;
  [key: string]: unknown;
}

// What a DocumentLoader produces — raw, not-yet-cleaned content plus
// whatever extra metadata the loader could infer (e.g. category from a
// filename). Not every game document needs every metadata field, so
// loader-supplied metadata is a loose bag until extractMetadata() fills
// in the required fields.
export interface RawDocument {
  id: string;
  title: string;
  content: string;
  source: string;
  sourceType: SourceType;
  gameSlug: string;
  metadata: Record<string, unknown>;
}

// A RawDocument after text normalization and metadata extraction — ready
// to be chunked.
export interface ProcessedDocument {
  id: string;
  title: string;
  content: string;
  source: string;
  sourceType: SourceType;
  gameSlug: string;
  metadata: DocumentMetadata;
}

// A single chunk of a ProcessedDocument, ready to be embedded in Phase 5.
// Carries a full copy of the document's metadata (not just documentId) so
// a chunk is self-describing once it's on its own in a vector index —
// search results won't need a join back to a documents table.
export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  metadata: DocumentMetadata;
  chunkIndex: number;
  chunkCount: number;
}

export interface IngestResult {
  documents: ProcessedDocument[];
  chunks: DocumentChunk[];
}
