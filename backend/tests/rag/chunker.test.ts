import { chunkDocument, chunkText } from "../../src/rag/chunkers/chunker";
import { ProcessedDocument } from "../../src/rag/types/document";

// Builds a paragraph of exactly `wordCount` short, distinct words so word
// counts are easy to reason about in assertions.
function makeParagraph(wordCount: number, prefix = "word"): string {
  return Array.from({ length: wordCount }, (_, i) => `${prefix}${i}`).join(" ");
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

describe("chunkText", () => {
  it("returns a single chunk for content smaller than chunkSize", () => {
    const content = makeParagraph(50);
    const chunks = chunkText(content, { chunkSize: 1000, overlap: 150 });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toBe(content);
  });

  it("creates multiple chunks for large documents", () => {
    // Three ~1200-word paragraphs, well over the 1000-word default chunk size.
    const content = [makeParagraph(1200, "a"), makeParagraph(1200, "b"), makeParagraph(1200, "c")].join(
      "\n\n"
    );
    const chunks = chunkText(content, { chunkSize: 1000, overlap: 150 });

    expect(chunks.length).toBeGreaterThan(1);
  });

  it("respects the configured chunk size (within the documented overlap bound)", () => {
    const content = Array.from({ length: 6 }, (_, i) => makeParagraph(300, `p${i}-`)).join("\n\n");
    const chunkSize = 500;
    const overlap = 100;
    const chunks = chunkText(content, { chunkSize, overlap });

    for (const chunk of chunks) {
      expect(countWords(chunk)).toBeLessThanOrEqual(chunkSize + overlap);
    }
  });

  it("applies overlap between consecutive chunks", () => {
    const content = [makeParagraph(600, "a"), makeParagraph(600, "b")].join("\n\n");
    const chunks = chunkText(content, { chunkSize: 600, overlap: 100 });

    expect(chunks.length).toBeGreaterThanOrEqual(2);

    const firstChunkWords = chunks[0].split(/\s+/);
    const lastWordsOfFirst = firstChunkWords.slice(-100).join(" ");
    expect(chunks[1].startsWith(lastWordsOfFirst)).toBe(true);
  });

  it("does not create empty chunks", () => {
    const content = "\n\n\n   \n\n";
    const chunks = chunkText(content, { chunkSize: 1000, overlap: 150 });
    expect(chunks).toEqual([]);
  });

  it("splits a single oversized paragraph internally", () => {
    const content = makeParagraph(2500);
    const chunks = chunkText(content, { chunkSize: 1000, overlap: 0 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(countWords(chunk)).toBeLessThanOrEqual(1000);
      expect(chunk.trim().length).toBeGreaterThan(0);
    }
  });

  it("produces deterministic output for the same input", () => {
    const content = [makeParagraph(1500, "x"), makeParagraph(800, "y")].join("\n\n");
    const first = chunkText(content, { chunkSize: 1000, overlap: 150 });
    const second = chunkText(content, { chunkSize: 1000, overlap: 150 });

    expect(first).toEqual(second);
  });

  it("rejects invalid chunker options", () => {
    expect(() => chunkText("hello world", { chunkSize: 0 })).toThrow();
    expect(() => chunkText("hello world", { chunkSize: 100, overlap: -1 })).toThrow();
    expect(() => chunkText("hello world", { chunkSize: 100, overlap: 100 })).toThrow();
  });
});

describe("chunkDocument", () => {
  const baseDoc: ProcessedDocument = {
    id: "some-game-overview",
    title: "Some Game Overview",
    content: [makeParagraph(1200, "a"), makeParagraph(1200, "b")].join("\n\n"),
    source: "data/knowledge/some-game/overview.md",
    sourceType: "file",
    gameSlug: "some-game",
    metadata: {
      documentId: "some-game-overview",
      title: "Some Game Overview",
      source: "data/knowledge/some-game/overview.md",
      sourceType: "file",
      gameSlug: "some-game",
      category: "overview",
    },
  };

  it("preserves document metadata on every chunk", () => {
    const chunks = chunkDocument(baseDoc, { chunkSize: 1000, overlap: 150 });

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.metadata).toEqual(baseDoc.metadata);
      expect(chunk.documentId).toBe(baseDoc.id);
    }
  });

  it("produces deterministic chunk ids based on document id and index", () => {
    const chunks = chunkDocument(baseDoc, { chunkSize: 1000, overlap: 150 });

    chunks.forEach((chunk, index) => {
      expect(chunk.id).toBe(`${baseDoc.id}-chunk-${index}`);
      expect(chunk.chunkIndex).toBe(index);
      expect(chunk.chunkCount).toBe(chunks.length);
    });
  });
});
