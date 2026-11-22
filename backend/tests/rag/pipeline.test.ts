import path from "path";
import { IngestionPipeline } from "../../src/rag/pipeline/ingestionPipeline";
import { MarkdownLoader } from "../../src/rag/loaders/markdownLoader";
import { DocumentLoader } from "../../src/rag/loaders/documentLoader";
import { RawDocument } from "../../src/rag/types/document";
import { ValidationError, NotFoundError } from "../../src/utils/AppError";

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures", "rag-loader");

describe("IngestionPipeline", () => {
  const pipeline = new IngestionPipeline(new MarkdownLoader(FIXTURES_DIR));

  it("successfully processes a document directory end-to-end", async () => {
    const result = await pipeline.ingest(path.join(FIXTURES_DIR, "some-game"));

    expect(result.documents).toHaveLength(2); // doc.md + note.txt
    expect(result.chunks.length).toBeGreaterThanOrEqual(2);
    expect(result.documents.map((d) => d.id).sort()).toEqual([
      "some-game-doc",
      "some-game-note",
    ]);
  });

  it("rejects a document with empty content", async () => {
    await expect(
      pipeline.ingest(path.join(FIXTURES_DIR, "empty-doc", "empty.md"))
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws NotFoundError for a nonexistent source path", async () => {
    await expect(
      pipeline.ingest(path.join(FIXTURES_DIR, "does-not-exist"))
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects a document with a missing title", async () => {
    const fakeLoader: DocumentLoader = {
      async load(): Promise<RawDocument[]> {
        return [
          {
            id: "no-title-doc",
            title: "",
            content: "Some content.",
            source: "fake-source",
            sourceType: "manual",
            gameSlug: "some-game",
            metadata: {},
          },
        ];
      },
    };
    await expect(
      new IngestionPipeline(fakeLoader).ingest("irrelevant")
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a document with a missing gameSlug", async () => {
    const fakeLoader: DocumentLoader = {
      async load(): Promise<RawDocument[]> {
        return [
          {
            id: "no-slug-doc",
            title: "No Slug",
            content: "Some content.",
            source: "fake-source",
            sourceType: "manual",
            gameSlug: "",
            metadata: {},
          },
        ];
      },
    };
    await expect(
      new IngestionPipeline(fakeLoader).ingest("irrelevant")
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws ValidationError for a source with no supported documents", async () => {
    await expect(pipeline.ingest(path.join(FIXTURES_DIR, "empty-dir"))).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it("produces the expected chunk count and preserves game metadata for a single document", async () => {
    const result = await pipeline.ingest(path.join(FIXTURES_DIR, "some-game", "doc.md"));

    expect(result.documents).toHaveLength(1);
    expect(result.chunks.length).toBeGreaterThanOrEqual(1);

    const [document] = result.documents;
    expect(document.gameSlug).toBe("some-game");
    expect(document.metadata.gameSlug).toBe("some-game");
    expect(document.metadata.documentId).toBe(document.id);

    for (const chunk of result.chunks) {
      expect(chunk.documentId).toBe(document.id);
      expect(chunk.metadata.gameSlug).toBe("some-game");
    }
  });

  it("rejects a batch with duplicate document ids", async () => {
    const duplicateId = "some-game-doc";
    const fakeLoader: DocumentLoader = {
      async load(): Promise<RawDocument[]> {
        const doc: RawDocument = {
          id: duplicateId,
          title: "Duplicate",
          content: "Some content here.",
          source: "fake-source",
          sourceType: "manual",
          gameSlug: "some-game",
          metadata: {},
        };
        return [doc, { ...doc }];
      },
    };
    const duplicatePipeline = new IngestionPipeline(fakeLoader);

    await expect(duplicatePipeline.ingest("irrelevant")).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it("produces chunk counts proportional to document size with a small chunk size", async () => {
    const smallChunkPipeline = new IngestionPipeline(new MarkdownLoader(FIXTURES_DIR), {
      chunkSize: 10,
      overlap: 2,
    });

    const result = await smallChunkPipeline.ingest(
      path.join(FIXTURES_DIR, "some-game", "doc.md")
    );

    // The fixture doc has more than 10 words, so a chunkSize of 10 should
    // force it to split into multiple chunks.
    expect(result.chunks.length).toBeGreaterThan(1);
  });
});
