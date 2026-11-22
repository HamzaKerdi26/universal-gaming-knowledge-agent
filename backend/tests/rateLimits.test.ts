import express from "express";
import request from "supertest";
import { createRateLimiter } from "../src/middleware/rateLimits";

describe("in-process rate limits", () => {
  it("keeps route buckets independent, returns 429, then allows requests after the window", async () => {
    const app = express();
    const firstLimiter = createRateLimiter({ limit: 1, windowMs: 50 });
    const secondLimiter = createRateLimiter({ limit: 1, windowMs: 50 });
    app.get("/first", firstLimiter, (_req, res) => res.sendStatus(200));
    app.get("/second", secondLimiter, (_req, res) => res.sendStatus(200));

    expect((await request(app).get("/first")).status).toBe(200);
    const limited = await request(app).get("/first");
    expect(limited.status).toBe(429);
    expect(limited.body.error.message).toBe("Too many requests. Please try again later.");
    expect((await request(app).get("/second")).status).toBe(200);

    await new Promise((resolve) => setTimeout(resolve, 70));
    expect((await request(app).get("/first")).status).toBe(200);
  });
});