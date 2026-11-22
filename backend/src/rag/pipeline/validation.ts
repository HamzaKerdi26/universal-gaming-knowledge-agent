import { ValidationError } from "../../utils/AppError";
import { DocumentChunk, RawDocument } from "../types/document";

export function validateRawDocument(doc: RawDocument): void {
  if (!doc.content || doc.content.trim().length === 0) {
    throw new ValidationError(`Document "${doc.id}" has empty content`);
  }
  if (!doc.title || doc.title.trim().length === 0) {
    throw new ValidationError(`Document "${doc.id}" is missing a title`);
  }
  if (!doc.gameSlug || doc.gameSlug.trim().length === 0) {
    throw new ValidationError(`Document "${doc.id}" is missing a gameSlug`);
  }
}

export function validateChunk(chunk: DocumentChunk): void {
  if (!chunk.content || chunk.content.trim().length === 0) {
    throw new ValidationError(
      `Chunk "${chunk.id}" for document "${chunk.documentId}" is empty`
    );
  }
}

export function checkDuplicateDocumentIds(docs: RawDocument[]): void {
  const seen = new Set<string>();
  for (const doc of docs) {
    if (seen.has(doc.id)) {
      throw new ValidationError(`Duplicate document id detected: "${doc.id}"`);
    }
    seen.add(doc.id);
  }
}
