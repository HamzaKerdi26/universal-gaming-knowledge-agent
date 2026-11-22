import {
  ADMIN_AUTHORIZATION,
  NON_ADMIN_AUTHORIZATION,
  createAdminTestUsers,
  deleteAdminTestUsers,
} from "./helpers/adminTestAuth";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";

const app = createApp();

const testSlug = "test-game-jest";
const adminTestSlug = "test-admin-authorized";

async function cleanup() {
  await prisma.game.deleteMany({ where: { slug: { in: [testSlug, adminTestSlug] } } });
}

beforeAll(async () => {
  await createAdminTestUsers();
  await cleanup();
});
afterAll(async () => {
  await cleanup();
  await deleteAdminTestUsers();
  await prisma.$disconnect();
});

describe("Game API", () => {
  let createdId: string;

  it("creates a game", async () => {
    const res = await request(app).post("/api/games").set("Authorization", ADMIN_AUTHORIZATION).send({
      title: "Jest Test Game",
      slug: testSlug,
      description: "A game created during automated tests.",
      developer: "Test Studio",
      publisher: "Test Publisher",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.slug).toBe(testSlug);
    createdId = res.body.data.id;
  });

  it("rejects invalid game creation payloads", async () => {
    const res = await request(app).post("/api/games").set("Authorization", ADMIN_AUTHORIZATION).send({
      title: "",
      slug: "Not A Valid Slug!",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe("Validation failed");

    // Regression guard: error.details is only populated when
    // errorHandler's `err instanceof ValidationError` check actually
    // matches. A prototype-chain bug in AppError (fixed in Phase 4)
    // previously made that check silently fail for every AppError
    // subclass, so this array would have been missing entirely.
    expect(Array.isArray(res.body.error.details)).toBe(true);
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(["title", "slug"]));
  });

  it("lists games and includes the created game", async () => {
    const res = await request(app).get("/api/games");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((g: { id: string }) => g.id === createdId)).toBe(true);
  });

  it("retrieves a game by id", async () => {
    const res = await request(app).get(`/api/games/${createdId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(createdId);
  });

  it("returns 404 for a nonexistent game id", async () => {
    const res = await request(app).get(
      "/api/games/00000000-0000-0000-0000-000000000000"
    );
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 for a malformed game id", async () => {
    const res = await request(app).get("/api/games/not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("updates a game", async () => {
    const res = await request(app)
      .put(`/api/games/${createdId}`)
      .set("Authorization", ADMIN_AUTHORIZATION)
      .send({ description: "Updated description" });

    expect(res.status).toBe(200);
    expect(res.body.data.description).toBe("Updated description");
  });

  it("deletes a game", async () => {
    const res = await request(app)
      .delete(`/api/games/${createdId}`)
      .set("Authorization", ADMIN_AUTHORIZATION);
    expect(res.status).toBe(204);

    const followUp = await request(app).get(`/api/games/${createdId}`);
    expect(followUp.status).toBe(404);
  });

  it("requires authentication and administrator identity for writes", async () => {
    const unauthenticated = await request(app).post("/api/games").send({
      title: "Unauthorized Game",
      slug: "unauthorized-game",
    });
    const spoofed = await request(app)
      .post("/api/games")
      .set("Authorization", NON_ADMIN_AUTHORIZATION)
      .send({ title: "Spoofed Admin Game", slug: "spoofed-admin-game", userId: "00000000-0000-4000-8000-000000000001" });

    expect(unauthenticated.status).toBe(401);
    expect(spoofed.status).toBe(403);
  });

  it("allows the configured administrator to create a game", async () => {
    const res = await request(app)
      .post("/api/games")
      .set("Authorization", ADMIN_AUTHORIZATION)
      .send({ title: "Authorized Admin Game", slug: adminTestSlug });

    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe(adminTestSlug);
    await prisma.game.deleteMany({ where: { slug: adminTestSlug } });
  });
});
