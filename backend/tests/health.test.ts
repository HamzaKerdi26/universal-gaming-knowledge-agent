import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";

const app = createApp();

describe("GET /api/health", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns 200 and status ok when the database is reachable", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("universal-gaming-knowledge-agent");
    expect(res.body.database).toBe("ok");
    expect(typeof res.body.timestamp).toBe("string");
  });
});
