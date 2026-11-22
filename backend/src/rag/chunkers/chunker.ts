import { DocumentChunk, ProcessedDocument } from "../types/document";

export interface ChunkerOptions {
  chunkSize?: number; // target words per chunk
  overlap?: number; // words carried from the end of one chunk into the start of the next
}

// Chosen to fall inside the 800–1200 word / 100–200 word overlap ranges
// that work well for this kind of prose-heavy gaming knowledge content,
// without pulling in a tokenizer dependency for what is, at this stage,
// plain word-count chunking.
const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_OVERLAP = 150;

// Splits normalized text into chunks, preferring to keep whole paragraphs
// together and only splitting a paragraph internally if it alone exceeds
// chunkSize. Pure and deterministic — same input always produces the
// same output, with no empty chunks.
//
// Size bound: each chunk's word count is guaranteed to be at most
// chunkSize + overlap. The "+ overlap" comes from carrying the previous
// chunk's trailing words forward — a chunk starts with up to `overlap`
// carried-over words, and the next indivisible block (a paragraph, or a
// pre-split piece of an oversized paragraph, each already <= chunkSize)
// is always added even if that pushes the total slightly past chunkSize,
// since a block can't be split further at that point. This is a standard
// trade-off for overlap-based chunking, not a bug.
export function chunkText(content: string, options: ChunkerOptions = {}): string[] {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;
  validateOptions(chunkSize, overlap);

  const paragraphs = splitParagraphs(content);
  if (paragraphs.length === 0) return [];

  // Pre-split any paragraph that alone exceeds chunkSize so the packing
  // loop below never has to special-case an over-limit paragraph.
  const blocks: string[] = [];
  for (const paragraph of paragraphs) {
    if (countWords(paragraph) > chunkSize) {
      blocks.push(...splitByWords(paragraph, chunkSize));
    } else {
      blocks.push(paragraph);
    }
  }

  const chunks: string[] = [];
  let current: string[] = [];
  let currentWords = 0;

  for (const block of blocks) {
    const blockWords = countWords(block);

    if (currentWords > 0 && currentWords + blockWords > chunkSize) {
      chunks.push(current.join("\n\n"));

      const overlapText = overlap > 0 ? takeLastWords(chunks[chunks.length - 1], overlap) : "";
      current = overlapText ? [overlapText] : [];
      currentWords = overlapText ? countWords(overlapText) : 0;
    }

    current.push(block);
    currentWords += blockWords;
  }

  if (current.length > 0) {
    chunks.push(current.join("\n\n"));
  }

  return chunks;
}

// Chunks a ProcessedDocument, wrapping each piece of text into a
// DocumentChunk with a deterministic id and the document's full metadata.
export function chunkDocument(
  doc: ProcessedDocument,
  options: ChunkerOptions = {}
): DocumentChunk[] {
  const pieces = chunkText(doc.content, options);

  return pieces.map((content, index) => ({
    id: `${doc.id}-chunk-${index}`,
    documentId: doc.id,
    content,
    metadata: doc.metadata,
    chunkIndex: index,
    chunkCount: pieces.length,
  }));
}

function toWords(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

function splitByWords(text: string, size: number): string[] {
  const words = toWords(text);
  const pieces: string[] = [];
  for (let i = 0; i < words.length; i += size) {
    pieces.push(words.slice(i, i + size).join(" "));
  }
  return pieces;
}

function takeLastWords(text: string, count: number): string {
  const words = toWords(text);
  return words.slice(Math.max(0, words.length - count)).join(" ");
}

function countWords(text: string): number {
  return toWords(text).length;
}

function splitParagraphs(content: string): string[] {
  return content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function validateOptions(chunkSize: number, overlap: number): void {
  if (chunkSize <= 0) throw new Error("chunkSize must be greater than 0");
  if (overlap < 0) throw new Error("overlap must be 0 or greater");
  if (overlap >= chunkSize) throw new Error("overlap must be smaller than chunkSize");
}
