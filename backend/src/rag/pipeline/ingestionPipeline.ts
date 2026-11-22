import { DocumentLoader } from "../loaders/documentLoader";
import { MarkdownLoader } from "../loaders/markdownLoader";
import { normalizeText } from "../processors/normalizer";
import { extractMetadata } from "../processors/metadataExtractor";
import { ChunkerOptions, chunkDocument } from "../chunkers/chunker";
import {
  checkDuplicateDocumentIds,
  validateChunk,
  validateRawDocument,
} from "./validation";
import { DocumentChunk, IngestResult, ProcessedDocument } from "../types/document";
import { ValidationError } from "../../utils/AppError";
import { logger } from "../../utils/logger";

// Orchestrates the full ingestion pipeline described in the Phase 4
// design: load -> normalize -> extract metadata -> chunk -> validate.
// Deliberately independent of any storage or vector database — it only
// transforms a source path into ProcessedDocuments and DocumentChunks and
// hands them back. Where those chunks end up (an in-memory cache today,
// Qdrant in Phase 5) is the caller's decision, not the pipeline's.
export class IngestionPipeline {
  constructor(
    private readonly loader: DocumentLoader = new MarkdownLoader(),
    private readonly chunkerOptions: ChunkerOptions = {}
  ) {}

  async ingest(source: string): Promise<IngestResult> {
    logger.info("Starting RAG ingestion", { source });

    const rawDocuments = await this.loader.load(source);
    if (rawDocuments.length === 0) {
      throw new ValidationError(`No documents found at "${source}"`);
    }

    checkDuplicateDocumentIds(rawDocuments);

    const documents: ProcessedDocument[] = [];
    const chunks: DocumentChunk[] = [];

    for (const raw of rawDocuments) {
      validateRawDocument(raw);

      const content = normalizeText(raw.content);
      const metadata = extractMetadata(raw);
      const processed: ProcessedDocument = {
        id: raw.id,
        title: raw.title,
        content,
        source: raw.source,
        sourceType: raw.sourceType,
        gameSlug: raw.gameSlug,
        metadata,
      };
      logger.info("Document normalized", { documentId: processed.id });

      const docChunks = chunkDocument(processed, this.chunkerOptions);
      docChunks.forEach(validateChunk);
      logger.info("Document chunked", {
        documentId: processed.id,
        chunkCount: docChunks.length,
      });

      documents.push(processed);
      chunks.push(...docChunks);
    }

    logger.info("Ingestion completed", {
      source,
      documentsProcessed: documents.length,
      chunksCreated: chunks.length,
    });

    return { documents, chunks };
  }
}

// A ready-to-use default instance (Markdown/text loader, default chunker
// options) for the common case — the API layer and CLI both use this.
export const ingestionPipeline = new IngestionPipeline();
