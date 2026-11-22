import { searchService } from "../../../src/rag/search/search.service";
import { vectorStore } from "../../../src/rag/store/vectorStore";
import { getEmbeddingProvider } from "../../../src/services/ai";

jest.mock("../../../src/rag/store/vectorStore", () => ({
  vectorStore: {
    search: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock("../../../src/services/ai", () => ({
  getEmbeddingProvider: jest.fn(),
}));

function makeFakeProvider(queryVector: number[]) {
  return {
    name: "gemini",
    model: "gemini-embedding-001",
    dimensions: queryVector.length,
    embedText: jest.fn().mockResolvedValue(queryVector),
    embedTexts: jest.fn(),
  };
}

describe("searchService.search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("embeds the query with RETRIEVAL_QUERY task type and searches with it", async () => {
    const provider = makeFakeProvider([0.1, 0.2, 0.3]);
    (getEmbeddingProvider as jest.Mock).mockReturnValue(provider);

    await searchService.search("How does combat work in Elden Ring?");

    expect(provider.embedText).toHaveBeenCalledWith(
      "How does combat work in Elden Ring?",
      "RETRIEVAL_QUERY"
    );
    expect(vectorStore.search).toHaveBeenCalledWith(
      [0.1, 0.2, 0.3],
      expect.objectContaining({ limit: 5 })
    );
  });

  it("defaults the limit to 5 when not provided", async () => {
    const provider = makeFakeProvider([0.1]);
    (getEmbeddingProvider as jest.Mock).mockReturnValue(provider);

    await searchService.search("query");

    const [, options] = (vectorStore.search as jest.Mock).mock.calls[0];
    expect(options.limit).toBe(5);
  });

  it("passes through a custom limit and gameSlug/category filters", async () => {
    const provider = makeFakeProvider([0.1]);
    (getEmbeddingProvider as jest.Mock).mockReturnValue(provider);

    await searchService.search("query", { limit: 10, gameSlug: "elden-ring", category: "lore" });

    const [, options] = (vectorStore.search as jest.Mock).mock.calls[0];
    expect(options).toEqual({ limit: 10, gameSlug: "elden-ring", category: "lore" });
  });

  it("maps vector matches into flattened SearchResultItems", async () => {
    const provider = makeFakeProvider([0.1]);
    (getEmbeddingProvider as jest.Mock).mockReturnValue(provider);
    (vectorStore.search as jest.Mock).mockResolvedValue([
      {
        id: "point-1",
        score: 0.91,
        payload: {
          chunkId: "elden-ring-combat-chunk-0",
          documentId: "elden-ring-combat",
          gameSlug: "elden-ring",
          category: "combat",
          title: "Elden Ring Combat",
          content: "Combat is stamina-driven...",
          chunkIndex: 0,
        },
      },
    ]);

    const results = await searchService.search("combat");

    expect(results).toEqual([
      {
        score: 0.91,
        chunkId: "elden-ring-combat-chunk-0",
        documentId: "elden-ring-combat",
        gameSlug: "elden-ring",
        category: "combat",
        title: "Elden Ring Combat",
        content: "Combat is stamina-driven...",
        chunkIndex: 0,
      },
    ]);
  });

  it("returns an empty array when there are no matches", async () => {
    const provider = makeFakeProvider([0.1]);
    (getEmbeddingProvider as jest.Mock).mockReturnValue(provider);
    (vectorStore.search as jest.Mock).mockResolvedValue([]);

    const results = await searchService.search("no matches for this");

    expect(results).toEqual([]);
  });
});
