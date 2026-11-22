import { qdrantService } from "../../../src/rag/vector/qdrantService";
import { setQdrantClientForTesting } from "../../../src/rag/vector/qdrantClient";
import { QdrantError } from "../../../src/rag/vector/errors";
import { VectorPoint } from "../../../src/rag/vector/types";

function makeFakeClient(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    getCollections: jest.fn().mockResolvedValue({ collections: [] }),
    createCollection: jest.fn().mockResolvedValue(true),
    upsert: jest.fn().mockResolvedValue({ status: "completed" }),
    query: jest.fn().mockResolvedValue({ points: [] }),
    delete: jest.fn().mockResolvedValue({ status: "completed" }),
    ...overrides,
  };
}

describe("qdrantService", () => {
  afterEach(() => {
    setQdrantClientForTesting(null);
  });

  describe("ensureCollection", () => {
    it("creates the collection with the exact vector size and cosine distance when it does not exist", async () => {
      const fakeClient = makeFakeClient({
        getCollections: jest.fn().mockResolvedValue({ collections: [] }),
      });
      setQdrantClientForTesting(fakeClient as never);

      await qdrantService.ensureCollection(768);

      expect(fakeClient.createCollection).toHaveBeenCalledTimes(1);
      const [collectionName, config] = fakeClient.createCollection.mock.calls[0];
      expect(typeof collectionName).toBe("string");
      expect(config.vectors).toEqual({ size: 768, distance: "Cosine" });
    });

    it("does not recreate the collection if it already exists", async () => {
      const fakeClient = makeFakeClient({
        getCollections: jest
          .fn()
          .mockResolvedValue({ collections: [{ name: "gaming_knowledge" }] }),
      });
      setQdrantClientForTesting(fakeClient as never);

      await qdrantService.ensureCollection(768);

      expect(fakeClient.createCollection).not.toHaveBeenCalled();
    });

    it("wraps a connection failure as a safe QdrantError", async () => {
      const fakeClient = makeFakeClient({
        getCollections: jest.fn().mockRejectedValue(new Error("ECONNREFUSED 127.0.0.1:6333")),
      });
      setQdrantClientForTesting(fakeClient as never);

      await expect(qdrantService.ensureCollection(768)).rejects.toBeInstanceOf(QdrantError);
      await expect(qdrantService.ensureCollection(768)).rejects.toMatchObject({
        statusCode: 503,
      });
      await qdrantService.ensureCollection(768).catch((err: QdrantError) => {
        expect(err.message).not.toMatch(/ECONNREFUSED/);
      });
    });
  });

  describe("upsertPoints", () => {
    const points: VectorPoint[] = [
      {
        id: "b7d4a209-8c1e-5466-938c-05bfa2c5a6c3",
        vector: [0.1, 0.2, 0.3],
        payload: {
          documentId: "elden-ring-combat",
          chunkId: "elden-ring-combat-chunk-0",
          title: "Elden Ring Combat",
          source: "data/knowledge/elden-ring/combat.md",
          sourceType: "file",
          gameSlug: "elden-ring",
          category: "combat",
          content: "Combat text",
          chunkIndex: 0,
        },
      },
    ];

    it("calls client.upsert with mapped points on the configured collection", async () => {
      const fakeClient = makeFakeClient();
      setQdrantClientForTesting(fakeClient as never);

      await qdrantService.upsertPoints(points);

      expect(fakeClient.upsert).toHaveBeenCalledTimes(1);
      const [collectionName, payload] = fakeClient.upsert.mock.calls[0];
      expect(typeof collectionName).toBe("string");
      expect(payload.points).toEqual([
        { id: points[0].id, vector: points[0].vector, payload: points[0].payload },
      ]);
    });

    it("does nothing for an empty points array", async () => {
      const fakeClient = makeFakeClient();
      setQdrantClientForTesting(fakeClient as never);

      await qdrantService.upsertPoints([]);

      expect(fakeClient.upsert).not.toHaveBeenCalled();
    });

    it("wraps an upsert failure as a safe QdrantError", async () => {
      const fakeClient = makeFakeClient({
        upsert: jest.fn().mockRejectedValue(new Error("dimension mismatch: expected 768")),
      });
      setQdrantClientForTesting(fakeClient as never);

      await expect(qdrantService.upsertPoints(points)).rejects.toBeInstanceOf(QdrantError);
    });
  });

  describe("searchPoints", () => {
    it("returns a 404 QdrantError when the collection does not exist yet", async () => {
      const fakeClient = makeFakeClient({
        getCollections: jest.fn().mockResolvedValue({ collections: [] }),
      });
      setQdrantClientForTesting(fakeClient as never);

      await expect(qdrantService.searchPoints([0.1, 0.2])).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(fakeClient.query).not.toHaveBeenCalled();
    });

    it("queries with the vector, limit, and maps results when the collection exists", async () => {
      const fakeClient = makeFakeClient({
        getCollections: jest
          .fn()
          .mockResolvedValue({ collections: [{ name: "gaming_knowledge" }] }),
        query: jest.fn().mockResolvedValue({
          points: [
            {
              id: "b7d4a209-8c1e-5466-938c-05bfa2c5a6c3",
              score: 0.91,
              payload: { documentId: "elden-ring-combat", content: "..." },
            },
          ],
        }),
      });
      setQdrantClientForTesting(fakeClient as never);

      const results = await qdrantService.searchPoints([0.1, 0.2], { limit: 3 });

      expect(results).toEqual([
        {
          id: "b7d4a209-8c1e-5466-938c-05bfa2c5a6c3",
          score: 0.91,
          payload: { documentId: "elden-ring-combat", content: "..." },
        },
      ]);

      const [, queryArgs] = fakeClient.query.mock.calls[0];
      expect(queryArgs.query).toEqual([0.1, 0.2]);
      expect(queryArgs.limit).toBe(3);
    });

    it("builds a metadata filter when gameSlug/category are provided", async () => {
      const fakeClient = makeFakeClient({
        getCollections: jest
          .fn()
          .mockResolvedValue({ collections: [{ name: "gaming_knowledge" }] }),
        query: jest.fn().mockResolvedValue({ points: [] }),
      });
      setQdrantClientForTesting(fakeClient as never);

      await qdrantService.searchPoints([0.1, 0.2], {
        gameSlug: "elden-ring",
        category: "combat",
      });

      const [, queryArgs] = fakeClient.query.mock.calls[0];
      expect(queryArgs.filter).toEqual({
        must: [
          { key: "gameSlug", match: { value: "elden-ring" } },
          { key: "category", match: { value: "combat" } },
        ],
      });
    });

    it("omits the filter entirely when no gameSlug/category are given", async () => {
      const fakeClient = makeFakeClient({
        getCollections: jest
          .fn()
          .mockResolvedValue({ collections: [{ name: "gaming_knowledge" }] }),
        query: jest.fn().mockResolvedValue({ points: [] }),
      });
      setQdrantClientForTesting(fakeClient as never);

      await qdrantService.searchPoints([0.1, 0.2]);

      const [, queryArgs] = fakeClient.query.mock.calls[0];
      expect(queryArgs.filter).toBeUndefined();
    });

    it("wraps a search failure as a safe QdrantError", async () => {
      const fakeClient = makeFakeClient({
        getCollections: jest
          .fn()
          .mockResolvedValue({ collections: [{ name: "gaming_knowledge" }] }),
        query: jest.fn().mockRejectedValue(new Error("internal qdrant error, trace=abc123")),
      });
      setQdrantClientForTesting(fakeClient as never);

      await expect(qdrantService.searchPoints([0.1, 0.2])).rejects.toBeInstanceOf(QdrantError);
      await qdrantService.searchPoints([0.1, 0.2]).catch((err: QdrantError) => {
        expect(err.message).not.toMatch(/trace=abc123/);
      });
    });

    it("surfaces a genuine connectivity failure as 503, not a 404 'nothing ingested' error", async () => {
      // Regression test: a real Qdrant-unreachable error must not be
      // silently reinterpreted as "the collection doesn't exist yet".
      const fakeClient = makeFakeClient({
        getCollections: jest.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      });
      setQdrantClientForTesting(fakeClient as never);

      await expect(qdrantService.searchPoints([0.1, 0.2])).rejects.toMatchObject({
        statusCode: 503,
      });
    });
  });

  describe("deletePointsByDocumentId", () => {
    it("deletes points matching a documentId filter", async () => {
      const fakeClient = makeFakeClient({
        getCollections: jest
          .fn()
          .mockResolvedValue({ collections: [{ name: "gaming_knowledge" }] }),
      });
      setQdrantClientForTesting(fakeClient as never);

      await qdrantService.deletePointsByDocumentId("elden-ring-combat");

      expect(fakeClient.delete).toHaveBeenCalledTimes(1);
      const [, deleteArgs] = fakeClient.delete.mock.calls[0];
      expect(deleteArgs.filter).toEqual({
        must: [{ key: "documentId", match: { value: "elden-ring-combat" } }],
      });
    });

    it("does nothing if the collection does not exist yet", async () => {
      const fakeClient = makeFakeClient({
        getCollections: jest.fn().mockResolvedValue({ collections: [] }),
      });
      setQdrantClientForTesting(fakeClient as never);

      await qdrantService.deletePointsByDocumentId("elden-ring-combat");

      expect(fakeClient.delete).not.toHaveBeenCalled();
    });

    it("surfaces a genuine connectivity failure as 503 rather than silently no-op'ing", async () => {
      // Regression test: same reasoning as the searchPoints case above —
      // an unreachable Qdrant must not be silently treated as "nothing
      // to delete."
      const fakeClient = makeFakeClient({
        getCollections: jest.fn().mockRejectedValue(new Error("ECONNREFUSED")),
      });
      setQdrantClientForTesting(fakeClient as never);

      await expect(
        qdrantService.deletePointsByDocumentId("elden-ring-combat")
      ).rejects.toMatchObject({ statusCode: 503 });
      expect(fakeClient.delete).not.toHaveBeenCalled();
    });
  });
});

