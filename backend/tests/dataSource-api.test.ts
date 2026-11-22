import { ADMIN_AUTHORIZATION, createAdminTestUsers, deleteAdminTestUsers } from "./helpers/adminTestAuth";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import { dataSourceRegistry } from "../src/dataSources/registry";
import { SourceType } from "../src/dataSources/types";

const app = createApp();

beforeAll(async () => {
  await createAdminTestUsers();
});

afterAll(async () => {
  await deleteAdminTestUsers();
  await prisma.$disconnect();
});

// The real dataSourceService module (loaded when createApp() first
// builds the router graph) auto-registers the Wikipedia source as a
// side effect, since it needs no credentials. Clearing before AND after
// each test keeps these tests deterministic regardless of that
// auto-registration or of test execution order — each test controls
// exactly which sources exist for its own assertions.
beforeEach(() => {
  dataSourceRegistry.clear();
});
afterEach(() => {
  dataSourceRegistry.clear();
});

describe("Data Source API", () => {
  describe("GET /api/sources", () => {
    it("lists registered sources", async () => {
      dataSourceRegistry.register({
        name: "fake-source",
        sourceType: SourceType.API,
        search: async () => [],
        fetchRecord: async () => null,
      });

      const res = await request(app).get("/api/sources");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sources).toEqual([
        { name: "fake-source", sourceType: SourceType.API },
      ]);
    });

    it("returns an empty list when no sources are registered", async () => {
      const res = await request(app).get("/api/sources");

      expect(res.status).toBe(200);
      expect(res.body.data.sources).toEqual([]);
    });
  });

  describe("GET /api/sources/:source/search", () => {
    it("returns search results from the named source", async () => {
      dataSourceRegistry.register({
        name: "fake-source",
        sourceType: SourceType.API,
        search: async (query) => [{ externalId: "1", title: `Result for ${query}` }],
        fetchRecord: async () => null,
      });

      const res = await request(app).get("/api/sources/fake-source/search?q=elden+ring");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.results).toEqual([
        { externalId: "1", title: "Result for elden ring" },
      ]);
    });

    it("uses the validated and trimmed query value in the source call", async () => {
      const search = jest.fn(async (query: string) => [{ externalId: "1", title: query }]);
      dataSourceRegistry.register({
        name: "trim-source",
        sourceType: SourceType.API,
        search,
        fetchRecord: async () => null,
      });

      const res = await request(app).get("/api/sources/trim-source/search?q=%20elden%20ring%20");

      expect(res.status).toBe(200);
      expect(search).toHaveBeenCalledWith("elden ring");
      expect(res.body.data.results[0].title).toBe("elden ring");
    });

    it("returns 400 when q is missing", async () => {
      const res = await request(app).get("/api/sources/fake-source/search");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe("Validation failed");
    });

    it("returns 400 when q is empty", async () => {
      const res = await request(app).get("/api/sources/fake-source/search?q=");

      expect(res.status).toBe(400);
    });

    it("returns 404 for an unknown source", async () => {
      const res = await request(app).get("/api/sources/does-not-exist/search?q=test");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("returns a sanitized error (no internal detail) when the source fails", async () => {
      dataSourceRegistry.register({
        name: "flaky-source",
        sourceType: SourceType.API,
        search: async () => {
          throw new Error("raw internal stack trace or credential leak");
        },
        fetchRecord: async () => null,
      });

      const res = await request(app).get("/api/sources/flaky-source/search?q=test");

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).not.toMatch(/raw internal stack trace|credential/);
    });
  });

  describe("POST /api/sources/:source/import", () => {
    it("returns 400 when externalId is missing", async () => {
      const res = await request(app)
        .post("/api/sources/fake-source/import")
        .set("Authorization", ADMIN_AUTHORIZATION)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toBe("Validation failed");
    });

    it("returns 404 for an unknown source", async () => {
      const res = await request(app)
        .post("/api/sources/does-not-exist/import")
        .set("Authorization", ADMIN_AUTHORIZATION)
        .send({ externalId: "123" });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("returns 404 when the source has no record for the given externalId", async () => {
      dataSourceRegistry.register({
        name: "fake-source",
        sourceType: SourceType.API,
        search: async () => [],
        fetchRecord: async () => null,
      });

      const res = await request(app)
        .post("/api/sources/fake-source/import")
        .set("Authorization", ADMIN_AUTHORIZATION)
        .send({ externalId: "does-not-exist" });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("returns the appropriate status code when the source itself fails (e.g. rate limited)", async () => {
      const { DataSourceError } = jest.requireActual("../src/dataSources/errors");
      dataSourceRegistry.register({
        name: "flaky-source",
        sourceType: SourceType.API,
        search: async () => [],
        fetchRecord: async () => {
          throw new DataSourceError("The source is rate-limiting requests.", 429);
        },
      });

      const res = await request(app)
        .post("/api/sources/flaky-source/import")
        .set("Authorization", ADMIN_AUTHORIZATION)
        .send({ externalId: "123" });

      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
    });
  });
});
