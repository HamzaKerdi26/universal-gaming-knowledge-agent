const { randomUUID } = require("crypto") as typeof import("crypto");
const ADMIN_USER_ID = randomUUID();
const NON_ADMIN_USER_ID = randomUUID();

process.env.JWT_SECRET = "phase10b-security-test-secret-with-32-plus-chars";
process.env.ADMIN_USER_IDS = ADMIN_USER_ID;
process.env.FRONTEND_ORIGINS = "http://localhost:5173";
process.env.RATE_LIMIT_WINDOW_MS = "60000";
process.env.AUTH_REGISTER_LIMIT = "2";
process.env.AUTH_LOGIN_LIMIT = "2";
process.env.CHAT_LIMIT = "2";
process.env.RAG_INGEST_LIMIT = "3";
process.env.SOURCE_IMPORT_LIMIT = "3";
process.env.RAG_SEARCH_LIMIT = "2";
process.env.SOURCE_SEARCH_LIMIT = "2";

const request = require("supertest") as typeof import("supertest");
const { createApp } = require("../src/app") as typeof import("../src/app");
const { createAccessToken } = require("../src/utils/jwt") as typeof import("../src/utils/jwt");
const { env } = require("../src/config/env") as typeof import("../src/config/env");
const { validateStartupConfig } = require("../src/config/startupValidation") as typeof import("../src/config/startupValidation");
const { prisma } = require("../src/config/prisma") as typeof import("../src/config/prisma");

const app = createApp();
const adminToken = createAccessToken(ADMIN_USER_ID);
const nonAdminToken = createAccessToken(NON_ADMIN_USER_ID);
const adminHeader = { Authorization: `Bearer ${adminToken}` };
const nonAdminHeader = { Authorization: `Bearer ${nonAdminToken}` };

beforeAll(async () => {
  await prisma.user.createMany({
    data: [
      { id: ADMIN_USER_ID, username: `security-admin-${ADMIN_USER_ID}`, email: `security-admin-${ADMIN_USER_ID}@example.test`, passwordHash: "test-only-hash" },
      { id: NON_ADMIN_USER_ID, username: `security-user-${NON_ADMIN_USER_ID}`, email: `security-user-${NON_ADMIN_USER_ID}@example.test`, passwordHash: "test-only-hash" },
    ],
  });
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [ADMIN_USER_ID, NON_ADMIN_USER_ID] } } });
  await prisma.$disconnect();
});

describe("Phase 10B security controls", () => {
  it("requires authentication and an allowlisted JWT subject for global writes", async () => {
    const unauthenticated = await request(app).post("/api/games").send({});
    const bodySpoof = await request(app)
      .post(`/api/games?userId=${ADMIN_USER_ID}`)
      .set(nonAdminHeader)
      .send({ userId: ADMIN_USER_ID });
    const adminReachesValidation = await request(app)
      .post("/api/games")
      .set(adminHeader)
      .send({});

    expect(unauthenticated.status).toBe(401);
    expect(bodySpoof.status).toBe(403);
    expect(adminReachesValidation.status).toBe(400);
  });

  it("protects RAG ingestion and source imports, leaving public reads available", async () => {
    const unauthenticatedIngest = await request(app).post("/api/rag/ingest").send({});
    const forbiddenIngest = await request(app).post("/api/rag/ingest").set(nonAdminHeader).send({});
    const adminIngestValidation = await request(app).post("/api/rag/ingest").set(adminHeader).send({});
    const unauthenticatedImport = await request(app).post("/api/sources/wiki/import").send({});
    const forbiddenImport = await request(app).post("/api/sources/wiki/import").set(nonAdminHeader).send({});
    const adminImportValidation = await request(app).post("/api/sources/wiki/import").set(adminHeader).send({});
    const publicSources = await request(app).get("/api/sources");

    expect(unauthenticatedIngest.status).toBe(401);
    expect(forbiddenIngest.status).toBe(403);
    expect(adminIngestValidation.status).toBe(400);
    expect(unauthenticatedImport.status).toBe(401);
    expect(forbiddenImport.status).toBe(403);
    expect(adminImportValidation.status).toBe(400);
    expect(publicSources.status).toBe(200);
  });

  it("applies separate limits to registration, login, chat, RAG, and source operations", async () => {
    const registerResponses = await Promise.all([
      request(app).post("/api/auth/register").send({}),
      request(app).post("/api/auth/register").send({}),
      request(app).post("/api/auth/register").send({}),
    ]);
    const loginResponses = await Promise.all([
      request(app).post("/api/auth/login").send({}),
      request(app).post("/api/auth/login").send({}),
      request(app).post("/api/auth/login").send({}),
    ]);
    const chatResponses = await Promise.all([
      request(app).post("/api/chat").set(adminHeader).send({}),
      request(app).post("/api/chat").set(adminHeader).send({}),
      request(app).post("/api/chat").set(adminHeader).send({}),
    ]);
    const ingestResponses = await Promise.all([
      request(app).post("/api/rag/ingest").set(adminHeader).send({}),
      request(app).post("/api/rag/ingest").set(adminHeader).send({}),
      request(app).post("/api/rag/ingest").set(adminHeader).send({}),
    ]);
    const importResponses = await Promise.all([
      request(app).post("/api/sources/wiki/import").set(adminHeader).send({}),
      request(app).post("/api/sources/wiki/import").set(adminHeader).send({}),
      request(app).post("/api/sources/wiki/import").set(adminHeader).send({}),
    ]);
    const ragSearchResponses = await Promise.all([
      request(app).post("/api/rag/search").send({}),
      request(app).post("/api/rag/search").send({}),
      request(app).post("/api/rag/search").send({}),
    ]);
    const sourceSearchResponses = await Promise.all([
      request(app).get("/api/sources/wiki/search"),
      request(app).get("/api/sources/wiki/search"),
      request(app).get("/api/sources/wiki/search"),
    ]);

    for (const responses of [
      registerResponses,
      loginResponses,
      chatResponses,
      ingestResponses,
      importResponses,
      ragSearchResponses,
      sourceSearchResponses,
    ]) {
      expect(responses.filter((response) => response.status === 400)).toHaveLength(2);
      const limited = responses.filter((response) => response.status === 429);
      expect(limited).toHaveLength(1);
      expect(limited[0].body.error.message).toBe("Too many requests. Please try again later.");
    }
  });

  it("allows configured CORS origins, rejects other origins, and serves security headers", async () => {
    const allowedPreflight = await request(app)
      .options("/api/conversations")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "authorization,content-type");
    const deniedPreflight = await request(app)
      .options("/api/conversations")
      .set("Origin", "https://attacker.example")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "authorization,content-type");
    const protectedResponse = await request(app).get("/api/conversations");

    expect(allowedPreflight.status).toBe(204);
    expect(allowedPreflight.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(allowedPreflight.headers["access-control-allow-headers"]).toContain("Authorization");
    expect(deniedPreflight.headers["access-control-allow-origin"]).toBeUndefined();
    expect(protectedResponse.headers["x-content-type-options"]).toBe("nosniff");
    expect(protectedResponse.headers["x-frame-options"]).toBeDefined();
    expect(protectedResponse.headers["referrer-policy"]).toBeDefined();
    expect(protectedResponse.headers["content-security-policy"]).toContain("frame-ancestors 'none'");
  });

  it("rejects missing/short production JWT configuration and accepts valid test configuration", () => {
    expect(() => validateStartupConfig({
      ...env,
      auth: { ...env.auth, jwtSecret: undefined },
    })).toThrow(/JWT_SECRET/);
    expect(() => validateStartupConfig({
      ...env,
      auth: { ...env.auth, jwtSecret: "short" },
    })).toThrow(/JWT_SECRET/);
    expect(() => validateStartupConfig({
      ...env,
      isProduction: true,
      cors: { allowedOrigins: [] },
    })).toThrow(/FRONTEND_ORIGINS/);
    expect(() => validateStartupConfig({
      ...env,
      rateLimit: { ...env.rateLimit, chatLimit: Number.NaN },
    })).toThrow(/Rate-limit settings/);
    expect(() => validateStartupConfig({
      ...env,
      auth: { ...env.auth, jwtExpiresInSeconds: Number.NaN },
    })).toThrow(/JWT_EXPIRES_IN_SECONDS/);
    expect(() => validateStartupConfig(env)).not.toThrow();
  });

  it("rejects malformed numeric rate-limit environment values", () => {
    const previous = process.env.CHAT_LIMIT;
    process.env.CHAT_LIMIT = "20requests";
    try {
      jest.isolateModules(() => {
        const { env: isolatedEnv } = require("../src/config/env") as typeof import("../src/config/env");
        const { validateStartupConfig: validate } = require("../src/config/startupValidation") as typeof import("../src/config/startupValidation");
        expect(isolatedEnv.rateLimit.chatLimit).toBe(Number.NaN);
        expect(() => validate(isolatedEnv)).toThrow(/Rate-limit settings/);
      });
    } finally {
      if (previous === undefined) delete process.env.CHAT_LIMIT;
      else process.env.CHAT_LIMIT = previous;
    }
  });
});