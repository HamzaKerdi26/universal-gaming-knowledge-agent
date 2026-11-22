import { randomUUID } from "crypto";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import { createAccessToken } from "../src/utils/jwt";

const app = createApp();
let ownerUserId: string;
let otherUserId: string;
let ownerToken: string;
let otherToken: string;

function authorization(token: string) {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  process.env.JWT_SECRET ??= "phase9b-history-test-secret-over-32-characters";
  const nonce = randomUUID();
  const owner = await prisma.user.create({
    data: {
      username: `history-owner-${nonce}`,
      email: `history-owner-${nonce}@example.test`,
      passwordHash: "test-only-hash",
    },
  });
  const other = await prisma.user.create({
    data: {
      username: `history-other-${nonce}`,
      email: `history-other-${nonce}@example.test`,
      passwordHash: "test-only-hash",
    },
  });
  ownerUserId = owner.id;
  otherUserId = other.id;
  ownerToken = createAccessToken(owner.id);
  otherToken = createAccessToken(other.id);
});

beforeEach(async () => {
  await prisma.conversation.deleteMany({
    where: { userId: { in: [ownerUserId, otherUserId] } },
  });
});

afterAll(async () => {
  const userIds = [ownerUserId, otherUserId].filter((id): id is string => !!id);
  if (userIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  await prisma.$disconnect();
});

describe("Authenticated conversation history API", () => {
  it("lists only the authenticated user's conversations, ignoring query userId", async () => {
    const ownConversation = await prisma.conversation.create({
      data: { userId: ownerUserId, title: "My conversation" },
    });
    await prisma.conversation.create({
      data: { userId: otherUserId, title: "Other user's conversation" },
    });

    const response = await request(app)
      .get("/api/conversations")
      .query({ userId: otherUserId })
      .set(authorization(ownerToken));

    expect(response.status).toBe(200);
    expect(response.body.data.conversations.map((item: { id: string }) => item.id)).toEqual([
      ownConversation.id,
    ]);
    expect(response.body.data.pagination).toMatchObject({ page: 1, limit: 100, totalCount: 1, totalPages: 1 });
  });

  it("paginates conversations deterministically with defaults, custom limits, and an empty later page", async () => {
    const older = await prisma.conversation.create({
      data: {
        userId: ownerUserId,
        title: "Older",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    const newer = await prisma.conversation.create({
      data: {
        userId: ownerUserId,
        title: "Newer",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    });
    const middle = await prisma.conversation.create({
      data: {
        userId: ownerUserId,
        title: "Middle",
        createdAt: new Date("2026-01-01T12:00:00.000Z"),
        updatedAt: new Date("2026-01-01T12:00:00.000Z"),
      },
    });

    const defaults = await request(app)
      .get("/api/conversations")
      .set(authorization(ownerToken));
    expect(defaults.body.data.conversations.map((item: { id: string }) => item.id)).toEqual([
      newer.id,
      middle.id,
      older.id,
    ]);
    expect(defaults.body.data.pagination).toMatchObject({ page: 1, limit: 100, totalCount: 3, totalPages: 1 });

    const secondPage = await request(app)
      .get("/api/conversations?page=2&limit=1")
      .set(authorization(ownerToken));
    expect(secondPage.status).toBe(200);
    expect(secondPage.body.data.conversations.map((item: { id: string }) => item.id)).toEqual([
      middle.id,
    ]);
    expect(secondPage.body.data.pagination).toMatchObject({ page: 2, limit: 1, totalCount: 3, totalPages: 3 });

    const beyond = await request(app)
      .get("/api/conversations?page=4&limit=1")
      .set(authorization(ownerToken));
    expect(beyond.status).toBe(200);
    expect(beyond.body.data.conversations).toEqual([]);
    expect(beyond.body.data.pagination.totalCount).toBe(3);
  });

  it("uses stable ID tie-breakers when conversation activity or message timestamps match", async () => {
    const timestamp = new Date("2026-03-01T00:00:00.000Z");
    const conversationIds = [
      "00000000-0000-4000-8000-000000000011",
      "00000000-0000-4000-8000-000000000010",
    ];
    const conversations = await Promise.all(conversationIds.map((id) =>
      prisma.conversation.create({
        data: { id, userId: ownerUserId, createdAt: timestamp, updatedAt: timestamp },
      })
    ));

    const listResponse = await request(app)
      .get("/api/conversations")
      .set(authorization(ownerToken));
    expect(listResponse.body.data.conversations.slice(0, 2).map((item: { id: string }) => item.id)).toEqual([
      ...conversationIds,
    ]);

    await Promise.all([
      prisma.message.create({
        data: {
          id: "00000000-0000-4000-8000-000000000021",
          conversationId: conversations[0].id,
          role: "user",
          content: "higher id",
          createdAt: timestamp,
        },
      }),
      prisma.message.create({
        data: {
          id: "00000000-0000-4000-8000-000000000020",
          conversationId: conversations[0].id,
          role: "assistant",
          content: "lower id",
          createdAt: timestamp,
        },
      }),
    ]);
    const messageResponse = await request(app)
      .get(`/api/conversations/${conversations[0].id}/messages`)
      .set(authorization(ownerToken));

    expect(messageResponse.body.data.messages.map((message: { id: string }) => message.id)).toEqual([
      "00000000-0000-4000-8000-000000000020",
      "00000000-0000-4000-8000-000000000021",
    ]);
  });

  it("accepts the maximum page size and rejects a larger one or malformed page", async () => {
    const maximum = await request(app)
      .get("/api/conversations?limit=100")
      .set(authorization(ownerToken));
    const tooLarge = await request(app)
      .get("/api/conversations?limit=101")
      .set(authorization(ownerToken));
    const malformed = await request(app)
      .get("/api/conversations?page=one")
      .set(authorization(ownerToken));

    expect(maximum.status).toBe(200);
    expect(maximum.body.data.pagination.limit).toBe(100);
    expect(tooLarge.status).toBe(400);
    expect(malformed.status).toBe(400);
  });

  it("retrieves an owned conversation", async () => {
    const conversation = await prisma.conversation.create({
      data: { userId: ownerUserId, title: "Owned" },
    });

    const response = await request(app)
      .get(`/api/conversations/${conversation.id}`)
      .set(authorization(ownerToken));

    expect(response.status).toBe(200);
    expect(response.body.data.conversation.id).toBe(conversation.id);
    expect(response.body.data.conversation.userId).toBe(ownerUserId);
  });

  it("does not retrieve another user's conversation", async () => {
    const conversation = await prisma.conversation.create({
      data: { userId: otherUserId, title: "Private" },
    });

    const response = await request(app)
      .get(`/api/conversations/${conversation.id}`)
      .set(authorization(ownerToken));

    expect(response.status).toBe(404);
  });

  it("returns owned messages in chronological order", async () => {
    const conversation = await prisma.conversation.create({ data: { userId: ownerUserId } });
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "assistant",
        content: "Later message",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    });
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: "user",
        content: "Earlier message",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    });

    const response = await request(app)
      .get(`/api/conversations/${conversation.id}/messages`)
      .set(authorization(ownerToken));

    expect(response.status).toBe(200);
    expect(response.body.data.messages.map((message: { content: string }) => message.content)).toEqual([
      "Earlier message",
      "Later message",
    ]);
    expect(response.body.data.pagination).toMatchObject({ page: 1, limit: 100, totalCount: 2, totalPages: 1 });
  });

  it("paginates messages with stable chronological ordering and empty out-of-range pages", async () => {
    const conversation = await prisma.conversation.create({ data: { userId: ownerUserId } });
    for (let index = 0; index < 3; index += 1) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          role: index % 2 === 0 ? "user" : "assistant",
          content: `message-${index}`,
          createdAt: new Date(`2026-02-0${index + 1}T00:00:00.000Z`),
        },
      });
    }

    const pageOne = await request(app)
      .get(`/api/conversations/${conversation.id}/messages?limit=2`)
      .set(authorization(ownerToken));
    const pageTwo = await request(app)
      .get(`/api/conversations/${conversation.id}/messages?page=2&limit=2`)
      .set(authorization(ownerToken));
    const beyond = await request(app)
      .get(`/api/conversations/${conversation.id}/messages?page=3&limit=2`)
      .set(authorization(ownerToken));

    expect(pageOne.body.data.messages.map((message: { content: string }) => message.content)).toEqual([
      "message-0",
      "message-1",
    ]);
    expect(pageTwo.body.data.messages.map((message: { content: string }) => message.content)).toEqual([
      "message-2",
    ]);
    expect(pageOne.body.data.pagination).toMatchObject({ page: 1, limit: 2, totalCount: 3, totalPages: 2 });
    expect(beyond.status).toBe(200);
    expect(beyond.body.data.messages).toEqual([]);
  });

  it("rejects invalid pagination query values", async () => {
    const response = await request(app)
      .get("/api/conversations?limit=0")
      .set(authorization(ownerToken));
    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe("Validation failed");
  });

  it("does not retrieve messages from another user's conversation", async () => {
    const conversation = await prisma.conversation.create({ data: { userId: otherUserId } });
    await prisma.message.create({
      data: { conversationId: conversation.id, role: "user", content: "Private message" },
    });

    const response = await request(app)
      .get(`/api/conversations/${conversation.id}/messages`)
      .set(authorization(ownerToken));

    expect(response.status).toBe(404);
  });

  it("creates a conversation owned by the authenticated user", async () => {
    const response = await request(app)
      .post("/api/conversations")
      .set(authorization(ownerToken))
      .send({ title: "New conversation" });

    expect(response.status).toBe(201);
    expect(response.body.data.conversation.userId).toBe(ownerUserId);
    expect(response.body.data.conversation.title).toBe("New conversation");
  });

  it("ignores a client-supplied userId when creating a conversation", async () => {
    const response = await request(app)
      .post("/api/conversations")
      .set(authorization(ownerToken))
      .send({ title: "Still mine", userId: otherUserId });

    expect(response.status).toBe(201);
    expect(response.body.data.conversation.userId).toBe(ownerUserId);
  });

  it("rejects unauthenticated requests to all conversation endpoints", async () => {
    const conversationId = randomUUID();
    const responses = await Promise.all([
      request(app).get("/api/conversations"),
      request(app).get(`/api/conversations/${conversationId}`),
      request(app).get(`/api/conversations/${conversationId}/messages`),
      request(app).post("/api/conversations").send({ title: "No token" }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401]);
  });
});