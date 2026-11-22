import { randomUUID } from "crypto";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";

const app = createApp();
const email = `registration-race-${randomUUID()}@example.test`;
const username = `registration-race-${randomUUID()}`;

beforeAll(() => {
  process.env.JWT_SECRET ??= "phase10c-concurrency-test-secret-over-32-characters";
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

it("allows only one account when duplicate registrations race", async () => {
  const register = () => request(app).post("/api/auth/register").send({
    email,
    username,
    password: "Concurrent-registration-test-2026!",
  });

  const responses = await Promise.all([register(), register()]);

  expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
  expect(await prisma.user.count({ where: { email } })).toBe(1);
});