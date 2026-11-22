import { vectorStore } from "../../../src/rag/store/vectorStore";
import { qdrantService } from "../../../src/rag/vector/qdrantService";
import { getEmbeddingProvider } from "../../../src/services/ai";
import { EmbeddingProviderError } from "../../../src/services/ai/embeddingProvider";
import { DocumentChunk } from "../../../src/rag/types/document";

jest.mock("../../../src/rag/vector/qdrantService", () => ({
  qdrantService: {
    ensureCollection: jest.fn().mockResolvedValue(undefined),
    upsertPoints: jest.fn().mockResolvedValue(undefined),
    searchPoints: jest.fn().mockResolvedValue([]),
    deletePointsByDocumentId: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../../../src/services/ai", () => ({
  getEmbeddingProvider: jest.fn(),
}));

function makeChunk(overrides: Partial<DocumentChunk> = {}): DocumentChunk {
  return {
    id: "elden-ring-combat-chunk-0",
    documentId: "elden-ring-combat",
    content: "Combat text",
    chunkIndex: 0,
    chunkCount: 1,
    metadata: {
      documentId: "elden-ring-combat",
      title: "Elden Ring Combat",
      source: "data/knowledge/elden-ring/combat.md",
      sourceType: "file",
      gameSlug: "elden-ring",
      category: "combat",
    },
    ...overrides,
  };
}

function makeFakeProvider(dimensions: number, vectors: number[][]) {
  return {
    name: "gemini",
    model: "gemini-embedding-001",
    dimensions,
    embedText: jest.fn(),
    embedTexts: jest.fn().mockResolvedValue(vectors),
  };
}

describe("vectorStore.upsertChunks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does nothing for an empty chunk list (no embedding call, no Qdrant call)", async () => {
    await vectorStore.upsertChunks([]);

    expect(getEmbeddingProvider).not.toHaveBeenCalled();
    expect(qdrantService.ensureCollection).not.toHaveBeenCalled();
  });

  it("ensures the collection, embeds all chunk contents, and upserts mapped points", async () => {
    const provider = makeFakeProvider(3, [
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ]);
    (getEmbeddingProvider as jest.Mock).mockReturnValue(provider);

    const chunks = [
      makeChunk({ id: "a-chunk-0", chunkIndex: 0 }),
      makeChunk({ id: "a-chunk-1", chunkIndex: 1 }),
    ];

    await vectorStore.upsertChunks(chunks);

    expect(qdrantService.ensureCollection).toHaveBeenCalledWith(3);
    expect(provider.embedTexts).toHaveBeenCalledWith(
      ["Combat text", "Combat text"],
      "RETRIEVAL_DOCUMENT"
    );

    expect(qdrantService.upsertPoints).toHaveBeenCalledTimes(1);
    const points = (qdrantService.upsertPoints as jest.Mock).mock.calls[0][0];
    expect(points).toHaveLength(2);
    expect(points[0].vector).toEqual([0.1, 0.2, 0.3]);
    expect(points[0].payload).toMatchObject({
      chunkId: "a-chunk-0",
      documentId: "elden-ring-combat",
      content: "Combat text",
      chunkIndex: 0,
      gameSlug: "elden-ring",
      category: "combat",
    });
  });

  it("produces the same point id for the same chunk across two separate calls (no duplicates on re-ingest)", async () => {
    const provider = makeFakeProvider(3, [[0.1, 0.2, 0.3]]);
    (getEmbeddingProvider as jest.Mock).mockReturnValue(provider);

    const chunk = makeChunk();

    await vectorStore.upsertChunks([chunk]);
    const firstId = (qdrantService.upsertPoints as jest.Mock).mock.calls[0][0][0].id;

    await vectorStore.upsertChunks([chunk]);
    const secondId = (qdrantService.upsertPoints as jest.Mock).mock.calls[1][0][0].id;

    expect(firstId).toBe(secondId);
  });

  it("throws EmbeddingProviderError when a returned vector's dimensions don't match the provider's declared dimensions", async () => {
    const provider = makeFakeProvider(768, [[0.1, 0.2, 0.3]]); // provider claims 768 but returns 3
    (getEmbeddingProvider as jest.Mock).mockReturnValue(provider);

    await expect(vectorStore.upsertChunks([makeChunk()])).rejects.toBeInstanceOf(
      EmbeddingProviderError
    );
    expect(qdrantService.upsertPoints).not.toHaveBeenCalled();
  });
});

describe("vectorStore.search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("delegates to qdrantService.searchPoints with the given vector and options", async () => {
    await vectorStore.search([0.1, 0.2], { limit: 3, gameSlug: "elden-ring" });

    expect(qdrantService.searchPoints).toHaveBeenCalledWith([0.1, 0.2], {
      limit: 3,
      gameSlug: "elden-ring",
    });
  });
});

describe("vectorStore.deleteDocumentChunks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("delegates to qdrantService.deletePointsByDocumentId", async () => {
    await vectorStore.deleteDocumentChunks("elden-ring-combat");
    expect(qdrantService.deletePointsByDocumentId).toHaveBeenCalledWith("elden-ring-combat");
  });
});
