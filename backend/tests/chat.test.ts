import request from "supertest";
import { randomUUID } from "crypto";
import { createApp } from "../src/app";
import { prisma } from "../src/config/prisma";
import { setLLMProviderForTesting } from "../src/services/ai";
import { LLMProviderError, LLMProvider } from "../src/services/ai/llmProvider";
import { createAccessToken } from "../src/utils/jwt";

// chat.service.ts delegates to the agent (src/agent/agent.service.ts),
// which runs the RAG capability (src/agent/capabilities/ragCapability.ts)
// before calling the LLM. That capability imports this same
// rag.service.ts module, so mocking it here still prevents any real
// Gemini embedding call or live Qdrant dependency for this suite,
// regardless of what GEMINI_API_KEY/QDRANT_URL happen to be configured
// locally — the same "no live external services in tests" principle
// already applied to Qdrant/embeddings elsewhere in this project.
// Agent/RAG-specific behavior (decision logic, context building,
// fallback on failure, etc.) is covered by tests/agent/ and
// tests/chat-rag-integration.test.ts instead.
jest.mock("../src/services/rag.service", () => ({
  ragService: { search: jest.fn().mockResolvedValue([]) },
}));

const app = createApp();

let testUserId: string | undefined;
let otherTestUserId: string | undefined;
let authToken: string;
let otherAuthToken: string;

beforeAll(async () => {
  process.env.JWT_SECRET ??= "phase9-chat-test-secret-with-more-than-32-chars";
  const unique = randomUUID();
  const user = await prisma.user.create({
    data: {
      username: `chat-test-${unique}`,
      email: `chat-test-${unique}@example.test`,
      passwordHash: "test-only-hash",
    },
  });
  const otherUnique = randomUUID();
  const otherUser = await prisma.user.create({
    data: {
      username: `chat-other-${otherUnique}`,
      email: `chat-other-${otherUnique}@example.test`,
      passwordHash: "test-only-hash",
    },
  });
  testUserId = user.id;
  otherTestUserId = otherUser.id;
  authToken = createAccessToken(user.id);
  otherAuthToken = createAccessToken(otherUser.id);
});

function authenticatedChatRequest() {
  return request(app).post("/api/chat").set("Authorization", `Bearer ${authToken}`);
}

// A fake provider so these tests never make a real Gemini API call.
const fakeProvider: LLMProvider = {
  name: "gemini",
  async generateReply(input) {
    return {
      content: `Mock reply to: ${input.message}`,
      model: "gemini-2.5-flash-mock",
    };
  },
};

let createdConversationId: string | undefined;

afterEach(() => {
  setLLMProviderForTesting(null);
});

afterAll(async () => {
  const userIds = [testUserId, otherTestUserId].filter((id): id is string => Boolean(id));
  if (userIds.length > 0) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("Chat API", () => {
  it("rejects an empty message", async () => {
    setLLMProviderForTesting(fakeProvider);
    const res = await authenticatedChatRequest().send({ message: "" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe("Validation failed");

    // Same regression guard as games.test.ts: confirms errorHandler's
    // `instanceof ValidationError` check is actually matching (see the
    // Phase 4 AppError prototype-chain fix).
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(
      res.body.error.details.some((d: { path: string }) => d.path === "message")
    ).toBe(true);
  });

  it("rejects an invalid request body (wrong type)", async () => {
    setLLMProviderForTesting(fakeProvider);
    const res = await authenticatedChatRequest().send({ message: 12345 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rejects a message over the length limit", async () => {
    setLLMProviderForTesting(fakeProvider);
    const res = await authenticatedChatRequest().send({ message: "a".repeat(4001) });

    expect(res.status).toBe(400);
  });

  it("returns a successful AI response and persists the conversation", async () => {
    setLLMProviderForTesting(fakeProvider);
    const res = await authenticatedChatRequest().send({
      message: "What is Elden Ring?",
      userId: "attacker-selected-id",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.provider).toBe("gemini");
    expect(res.body.data.model).toBe("gemini-2.5-flash-mock");
    expect(res.body.data.message).toContain("What is Elden Ring?");
    expect(res.body.data.conversationId).toBeTruthy();

    createdConversationId = res.body.data.conversationId;

    const messages = await prisma.message.findMany({
      where: { conversationId: createdConversationId },
      orderBy: { createdAt: "asc" },
    });
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("What is Elden Ring?");
    expect(messages[1].role).toBe("assistant");
    const conversation = await prisma.conversation.findUnique({
      where: { id: createdConversationId },
    });
    expect(conversation?.userId).toBe(testUserId);
  });

  it("continues an existing conversation using conversationId", async () => {
    setLLMProviderForTesting(fakeProvider);
    const res = await authenticatedChatRequest().send({
      message: "And what platform is it on?",
      conversationId: createdConversationId,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.conversationId).toBe(createdConversationId);

    const messages = await prisma.message.findMany({
      where: { conversationId: createdConversationId },
    });
    expect(messages).toHaveLength(4);
  });

  it("updates conversation activity when messages are persisted", async () => {
    setLLMProviderForTesting(fakeProvider);
    const baseline = new Date("2020-01-01T00:00:00.000Z");
    const conversation = await prisma.conversation.create({
      data: {
        userId: testUserId!,
        title: "Old conversation",
        createdAt: baseline,
        updatedAt: baseline,
      },
    });

    const response = await authenticatedChatRequest().send({
      message: "Continue this conversation",
      conversationId: conversation.id,
    });
    const updated = await prisma.conversation.findUnique({ where: { id: conversation.id } });

    expect(response.status).toBe(200);
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(baseline.getTime());
  });

  it("persists both turns when requests concurrently target the same conversation", async () => {
    setLLMProviderForTesting(fakeProvider);
    const baseline = new Date("2020-01-01T00:00:00.000Z");
    const conversation = await prisma.conversation.create({
      data: {
        userId: testUserId!,
        title: "Concurrent chat test",
        createdAt: baseline,
        updatedAt: baseline,
      },
    });

    const responses = await Promise.all([
      authenticatedChatRequest().send({ message: "hi", conversationId: conversation.id }),
      authenticatedChatRequest().send({ message: "thanks", conversationId: conversation.id }),
    ]);
    const messages = await prisma.message.findMany({
      where: { conversationId: conversation.id },
    });
    const updated = await prisma.conversation.findUnique({ where: { id: conversation.id } });

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(messages.filter((message) => message.role === "user")).toHaveLength(2);
    expect(messages.filter((message) => message.role === "assistant")).toHaveLength(2);
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(baseline.getTime());
  });

  it("does not allow a different authenticated user to continue the conversation", async () => {
    const res = await request(app)
      .post("/api/chat")
      .set("Authorization", `Bearer ${otherAuthToken}`)
      .send({ message: "Read the private history", conversationId: createdConversationId });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("returns 404 for a nonexistent conversationId", async () => {
    setLLMProviderForTesting(fakeProvider);
    const res = await authenticatedChatRequest().send({
      message: "Hello",
      conversationId: "00000000-0000-0000-0000-000000000000",
    });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 for a malformed conversationId", async () => {
    setLLMProviderForTesting(fakeProvider);
    const res = await authenticatedChatRequest().send({
      message: "Hello",
      conversationId: "not-a-uuid",
    });

    expect(res.status).toBe(400);
  });

  it("handles a provider/API failure without leaking internal details", async () => {
    setLLMProviderForTesting({
      name: "gemini",
      async generateReply() {
        throw new LLMProviderError(
          "The AI provider is currently unavailable. Please try again shortly."
        );
      },
    });

    const res = await authenticatedChatRequest().send({ message: "Hello" });

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).not.toMatch(/api[_ ]?key|sdk|stack|GoogleGenAI/i);
  });

  it("handles a provider timeout", async () => {
    setLLMProviderForTesting({
      name: "gemini",
      async generateReply() {
        throw new LLMProviderError(
          "The AI provider took too long to respond. Please try again.",
          504
        );
      },
    });

    const res = await authenticatedChatRequest().send({ message: "Hello" });

    expect(res.status).toBe(504);
    expect(res.body.success).toBe(false);
  });
});
