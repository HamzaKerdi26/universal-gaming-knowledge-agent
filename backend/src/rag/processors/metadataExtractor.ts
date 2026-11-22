import { DocumentMetadata, RawDocument } from "../types/document";

// Builds the full DocumentMetadata a chunk will carry: the required
// fields (documentId/title/source/sourceType/gameSlug) plus anything
// extra the loader supplied (category, tags, etc.). Kept as its own
// pipeline step so a future loader (e.g. a web loader) can attach richer
// metadata without changing how it's folded into the final shape here.
export function extractMetadata(doc: RawDocument): DocumentMetadata {
  const sourceType = doc.metadata.sourceType;
  return {
    ...doc.metadata,
    documentId: doc.id,
    title: doc.title,
    source: doc.source,
    sourceType: typeof sourceType === "string" ? sourceType : doc.sourceType,
    gameSlug: doc.gameSlug,
  };
}
