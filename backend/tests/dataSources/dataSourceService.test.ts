const mockRegistryGet = jest.fn();

jest.mock("../../src/dataSources/registry", () => ({
  dataSourceRegistry: {
    get: (...args: unknown[]) => mockRegistryGet(...args),
    list: jest.fn().mockReturnValue([]),
  },
}));

// dataSourceService side-effect-imports ../dataSources (index.ts), which
// registers the real RawgSource/WikipediaSource and touches env config.
// Mocked as an empty module so this suite never needs real credentials —
// dataSourceRegistry itself is already mocked above.
jest.mock("../../src/dataSources", () => ({}));

const mockFindBySlug = jest.fn();
const mockCreate = jest.fn();
const mockUpdate = jest.fn();

jest.mock("../../src/repositories/game.repository", () => ({
  gameRepository: {
    findBySlug: (...args: unknown[]) => mockFindBySlug(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
  },
}));

const mockUpsertChunks = jest.fn();

jest.mock("../../src/rag/store/vectorStore", () => ({
  vectorStore: { upsertChunks: (...args: unknown[]) => mockUpsertChunks(...args) },
}));

import { dataSourceService } from "../../src/services/dataSource.service";
import { SourceType } from "../../src/dataSources/types";

const apiRecord = {
  title: "Elden Ring",
  slug: "elden-ring",
  description: "An open-world action RPG.",
  developer: "FromSoftware",
  publisher: "Bandai Namco",
  releaseDate: "2022-02-25",
  genres: ["RPG"],
  platforms: ["PC"],
  imageUrl: "img.jpg",
  externalId: "123",
  source: "rawg",
  sourceType: SourceType.API,
  sourceUrl: "https://rawg.io/games/elden-ring",
  retrievedAt: "2026-01-01T00:00:00.000Z",
};

const wikiRecord = {
  title: "Elden Ring",
  slug: "elden-ring",
  content: "Elden Ring is a 2022 action role-playing game.",
  description: "Elden Ring is a 2022 action role-playing game.",
  externalId: "Elden Ring",
  source: "wikipedia",
  sourceType: SourceType.WIKI,
  sourceUrl: "https://en.wikipedia.org/wiki/Elden_Ring",
  retrievedAt: "2026-01-01T00:00:00.000Z",
};

function makeFakeSource(overrides: Record<string, unknown> = {}) {
  return {
    name: "fake",
    sourceType: SourceType.API,
    search: jest.fn().mockResolvedValue([]),
    fetchRecord: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe("dataSourceService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpsertChunks.mockResolvedValue(undefined);
  });

  describe("search", () => {
    it("delegates to the named source's search()", async () => {
      const search = jest.fn().mockResolvedValue([{ externalId: "1", title: "Elden Ring" }]);
      mockRegistryGet.mockReturnValue(makeFakeSource({ search }));

      const results = await dataSourceService.search("rawg", "elden ring");

      expect(mockRegistryGet).toHaveBeenCalledWith("rawg");
      expect(search).toHaveBeenCalledWith("elden ring");
      expect(results).toEqual([{ externalId: "1", title: "Elden Ring" }]);
    });

    it("throws NotFoundError for an unknown source", async () => {
      mockRegistryGet.mockReturnValue(undefined);
      await expect(dataSourceService.search("nonexistent", "query")).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("returns an empty array when the source finds nothing (not an error)", async () => {
      mockRegistryGet.mockReturnValue(makeFakeSource({ search: jest.fn().mockResolvedValue([]) }));

      const results = await dataSourceService.search("rawg", "xyzxyz-nonexistent");

      expect(results).toEqual([]);
    });

    it("propagates a provider/source-level failure (e.g. DataSourceError) rather than swallowing it", async () => {
      const { DataSourceError } = jest.requireActual("../../src/dataSources/errors");
      mockRegistryGet.mockReturnValue(
        makeFakeSource({
          search: jest.fn().mockRejectedValue(new DataSourceError("Source unavailable.", 503)),
        })
      );

      await expect(dataSourceService.search("rawg", "query")).rejects.toMatchObject({
        statusCode: 503,
      });
    });
  });

  describe("importRecord", () => {
    it("throws NotFoundError when the source has no record for the given externalId", async () => {
      mockRegistryGet.mockReturnValue(makeFakeSource({ fetchRecord: jest.fn().mockResolvedValue(null) }));

      await expect(dataSourceService.importRecord("rawg", "999")).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("persists a new game for an API-type record", async () => {
      mockRegistryGet.mockReturnValue(
        makeFakeSource({ fetchRecord: jest.fn().mockResolvedValue(apiRecord) })
      );
      mockFindBySlug.mockResolvedValue(null);
      mockCreate.mockResolvedValue({ id: "game-1", slug: "elden-ring", title: "Elden Ring" });

      const result = await dataSourceService.importRecord("rawg", "123");

      expect(mockFindBySlug).toHaveBeenCalledWith("elden-ring");
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ slug: "elden-ring", title: "Elden Ring", developer: "FromSoftware" })
      );
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(result.game).toEqual({ game: { id: "game-1", slug: "elden-ring", title: "Elden Ring" }, created: true });
    });

    it("updates (does not conflict on) an existing game for a duplicate import", async () => {
      mockRegistryGet.mockReturnValue(
        makeFakeSource({ fetchRecord: jest.fn().mockResolvedValue(apiRecord) })
      );
      mockFindBySlug.mockResolvedValue({ id: "game-1", slug: "elden-ring" });
      mockUpdate.mockResolvedValue({ id: "game-1", slug: "elden-ring", title: "Elden Ring (updated)" });

      const result = await dataSourceService.importRecord("rawg", "123");

      expect(mockUpdate).toHaveBeenCalledWith("game-1", expect.objectContaining({ title: "Elden Ring" }));
      expect(mockCreate).not.toHaveBeenCalled();
      expect(result.game?.created).toBe(false);
    });

    it("does NOT persist a Game row for a knowledge/WIKI-type record", async () => {
      mockRegistryGet.mockReturnValue(
        makeFakeSource({
          name: "wikipedia",
          sourceType: SourceType.WIKI,
          fetchRecord: jest.fn().mockResolvedValue(wikiRecord),
        })
      );

      const result = await dataSourceService.importRecord("wikipedia", "Elden Ring");

      expect(mockFindBySlug).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
      expect(result.game).toBeUndefined();
    });

    it("ingests the record into RAG/Qdrant via the existing vectorStore, preserving source metadata", async () => {
      mockRegistryGet.mockReturnValue(
        makeFakeSource({ fetchRecord: jest.fn().mockResolvedValue(apiRecord) })
      );
      mockFindBySlug.mockResolvedValue(null);
      mockCreate.mockResolvedValue({ id: "game-1", slug: "elden-ring" });

      const result = await dataSourceService.importRecord("rawg", "123");

      expect(result.ragIngested).toBe(true);
      expect(mockUpsertChunks).toHaveBeenCalledTimes(1);

      const chunks = mockUpsertChunks.mock.calls[0][0];
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].metadata).toMatchObject({
        gameSlug: "elden-ring",
        provider: "rawg",
        sourceType: SourceType.API,
        sourceUrl: "https://rawg.io/games/elden-ring",
        retrievedAt: "2026-01-01T00:00:00.000Z",
      });
      expect(chunks[0].content).toContain("Elden Ring");
      expect(chunks[0].content).toContain("FromSoftware");
    });

    it("ingests wiki content into RAG using the article body as the primary content", async () => {
      mockRegistryGet.mockReturnValue(
        makeFakeSource({
          name: "wikipedia",
          sourceType: SourceType.WIKI,
          fetchRecord: jest.fn().mockResolvedValue(wikiRecord),
        })
      );

      await dataSourceService.importRecord("wikipedia", "Elden Ring");

      const chunks = mockUpsertChunks.mock.calls[0][0];
      expect(chunks[0].content).toContain("Elden Ring is a 2022 action role-playing game.");
      expect(chunks[0].metadata.provider).toBe("wikipedia");
      expect(chunks[0].metadata.sourceType).toBe(SourceType.WIKI);
    });

    it("still succeeds (game persisted) when RAG ingestion fails — logs but does not throw", async () => {
      mockRegistryGet.mockReturnValue(
        makeFakeSource({ fetchRecord: jest.fn().mockResolvedValue(apiRecord) })
      );
      mockFindBySlug.mockResolvedValue(null);
      mockCreate.mockResolvedValue({ id: "game-1", slug: "elden-ring" });
      mockUpsertChunks.mockRejectedValue(new Error("Qdrant unreachable"));

      const result = await dataSourceService.importRecord("rawg", "123");

      expect(result.ragIngested).toBe(false);
      expect(result.game?.created).toBe(true); // DB import still succeeded
    });

    it("throws NotFoundError for an unknown source", async () => {
      mockRegistryGet.mockReturnValue(undefined);
      await expect(dataSourceService.importRecord("nonexistent", "1")).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("propagates a provider/source-level failure from fetchRecord rather than swallowing it", async () => {
      const { DataSourceError } = jest.requireActual("../../src/dataSources/errors");
      mockRegistryGet.mockReturnValue(
        makeFakeSource({
          fetchRecord: jest.fn().mockRejectedValue(new DataSourceError("Rate limited.", 429)),
        })
      );

      await expect(dataSourceService.importRecord("rawg", "123")).rejects.toMatchObject({
        statusCode: 429,
      });
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockUpsertChunks).not.toHaveBeenCalled();
    });
  });

  describe("listSources", () => {
    it("delegates to the registry", () => {
      dataSourceService.listSources();
      const { dataSourceRegistry } = jest.requireMock("../../src/dataSources/registry") as {
        dataSourceRegistry: { list: jest.Mock };
      };
      expect(dataSourceRegistry.list).toHaveBeenCalled();
    });
  });
});
