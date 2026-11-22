import { ADMIN_AUTHORIZATION, createAdminTestUsers, deleteAdminTestUsers } from "./helpers/adminTestAuth";

const mockUpsertChunks = jest.fn();

jest.mock("../src/rag/store/vectorStore", () => ({
  vectorStore: {
    upsertChunks: (...args: unknown[]) => mockUpsertChunks(...args),
    search: jest.fn().mockResolvedValue([]),
  },
}));

import path from "path";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";

const app = createApp();

beforeAll(async () => {
  await createAdminTestUsers();
});

beforeEach(() => {
  mockUpsertChunks.mockResolvedValue(undefined);
});

// These tests exercise the real default configuration (the pipeline used
// by the actual API is restricted to data/knowledge — see
// MarkdownLoader's allowedRoot), so they ingest from the real sample
// dataset rather than the test fixtures directory.

afterAll(async () => {
  await deleteAdminTestUsers();
  await prisma.$disconnect();
});

describe("RAG API", () => {
  describe("POST /api/rag/ingest", () => {
    it("successfully ingests a directory of documents", async () => {
      const res = await request(app)
        .post("/api/rag/ingest")
        .set("Authorization", ADMIN_AUTHORIZATION)
        .send({ path: "data/knowledge/dark-souls" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documentsProcessed).toBe(2); // overview.md + combat.md
      expect(res.body.data.chunksCreated).toBeGreaterThanOrEqual(2);
      expect(res.body.data.documentIds.sort()).toEqual([
        "dark-souls-combat",
        "dark-souls-overview",
      ]);
      expect(mockUpsertChunks).toHaveBeenCalledTimes(1);
    });

    it("rejects a request with a missing path", async () => {
      const res = await request(app)
        .post("/api/rag/ingest")
        .set("Authorization", ADMIN_AUTHORIZATION)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe("Validation failed");
      expect(
        res.body.error.details.some((d: { path: string }) => d.path === "path")
      ).toBe(true);
    });

    it("rejects an invalid request body (wrong type for path)", async () => {
      const res = await request(app)
        .post("/api/rag/ingest")
        .set("Authorization", ADMIN_AUTHORIZATION)
        .send({ path: 12345 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("returns 404 for a source path that does not exist under the knowledge directory", async () => {
      const res = await request(app)
        .post("/api/rag/ingest")
        .set("Authorization", ADMIN_AUTHORIZATION)
        .send({ path: "data/knowledge/does-not-exist" });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("rejects a path outside the allowed knowledge directory (security)", async () => {
      const res = await request(app)
        .post("/api/rag/ingest")
        .set("Authorization", ADMIN_AUTHORIZATION)
        .send({ path: path.join(__dirname, "fixtures", "rag-loader", "some-game") });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("rejects a traversal attempt (security)", async () => {
      const res = await request(app)
        .post("/api/rag/ingest")
        .set("Authorization", ADMIN_AUTHORIZATION)
        .send({ path: "data/knowledge/../../package.json" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /api/rag/documents/:documentId/chunks", () => {
    it("returns the chunks produced by a prior ingestion", async () => {
      await request(app)
        .post("/api/rag/ingest")
        .set("Authorization", ADMIN_AUTHORIZATION)
        .send({ path: "data/knowledge/elden-ring" });

      const res = await request(app).get(
        "/api/rag/documents/elden-ring-overview/chunks"
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.documentId).toBe("elden-ring-overview");
      expect(res.body.data.chunkCount).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(res.body.data.chunks)).toBe(true);
      expect(res.body.data.chunks[0].metadata.gameSlug).toBe("elden-ring");
    });

    it("returns 404 for a document that was never ingested", async () => {
      const res = await request(app).get(
        "/api/rag/documents/never-ingested-doc/chunks"
      );

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
