// Verifies chat.service.ts's actual current responsibility (Phase 6):
// conversation persistence and delegating to the agent — NOT RAG/LLM
// internals, which moved to src/agent/ and are covered by
// tests/agent/agent.service.test.ts and
// tests/agent/capabilities/ragCapability.test.ts instead. Keeping both
// sets of assertions in this file would just duplicate coverage across
// two layers for the same behavior.
//
// Fully mocked (repositories, agentService) so it runs without a
// generated Prisma client or a real Qdrant/Gemini connection — mirrors
// the jest.mock pattern already used elsewhere in this project.

const mockConversationCreate = jest.fn();
const mockConversationFindByIdForUser = jest.fn();
const mockMessageFindRecent = jest.fn();
const mockMessageCreate = jest.fn();
const mockAgentRun = jest.fn();

jest.mock("../src/repositories/conversation.repository", () => ({
  conversationRepository: {
    create: (...args: unknown[]) => mockConversationCreate(...args),
    findByIdForUser: (...args: unknown[]) => mockConversationFindByIdForUser(...args),
  },
}));

jest.mock("../src/repositories/message.repository", () => ({
  messageRepository: {
    findRecentByConversationId: (...args: unknown[]) => mockMessageFindRecent(...args),
    create: (...args: unknown[]) => mockMessageCreate(...args),
  },
}));

jest.mock("../src/agent/agent.service", () => ({
  agentService: { run: (...args: unknown[]) => mockAgentRun(...args) },
}));

import { chatService } from "../src/services/chat.service";
import { NotFoundError } from "../src/utils/AppError";

const USER_ID = "user-owner";

describe("chatService.sendMessage — agent delegation (Phase 6)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConversationCreate.mockResolvedValue({ id: "conv-1", userId: USER_ID });
    mockConversationFindByIdForUser.mockReset();
    mockMessageFindRecent.mockResolvedValue([]);
    mockMessageCreate.mockResolvedValue({});
    mockAgentRun.mockResolvedValue({
      message: "A reply.",
      model: "gemini-2.5-flash",
      provider: "gemini",
      context: { decision: { capabilities: [], reason: "n/a" }, capabilityResults: [] },
    });
  });

  it("persists the user's message BEFORE calling the agent, and calls the agent with it", async () => {
    const callOrder: string[] = [];
    mockMessageCreate.mockImplementation(async (_conversationId, role) => {
      if (role === "user") callOrder.push("persist-user");
      return {};
    });
    mockAgentRun.mockImplementation(async () => {
      callOrder.push("agent-run");
      return {
        message: "A reply.",
        model: "gemini-2.5-flash",
        provider: "gemini",
        context: { decision: { capabilities: [], reason: "n/a" }, capabilityResults: [] },
      };
    });

    await chatService.sendMessage({ message: "How does combat work in Elden Ring?" }, USER_ID);
    expect(callOrder).toEqual(["persist-user", "agent-run"]);
    expect(mockConversationCreate).toHaveBeenCalledWith(USER_ID);
    expect(mockAgentRun).toHaveBeenCalledWith({
      message: "How does combat work in Elden Ring?",
      history: [],
    });
  });

  it("persists the original message, never anything agent/RAG-augmented", async () => {
    await chatService.sendMessage({ message: "Tell me about the lore" }, USER_ID);

    const userMessageCall = mockMessageCreate.mock.calls.find((c) => c[1] === "user");
    expect(userMessageCall?.[2]).toBe("Tell me about the lore");
    expect(userMessageCall?.[2]).not.toContain("RETRIEVED GAMING KNOWLEDGE");
  });

  it("loads and passes prior conversation history to the agent", async () => {
    mockMessageFindRecent.mockResolvedValue([
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
    ]);

    await chatService.sendMessage({ message: "Follow up question" }, USER_ID);

    expect(mockAgentRun).toHaveBeenCalledWith({
      message: "Follow up question",
      history: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello!" },
      ],
    });
  });

  it("persists the agent's reply and returns the agent's message/model/provider", async () => {
    mockAgentRun.mockResolvedValue({
      message: "The maximum level is...",
      model: "gemini-2.5-flash",
      provider: "gemini",
      context: { decision: { capabilities: ["rag-search"], reason: "n/a" }, capabilityResults: [] },
    });

    const result = await chatService.sendMessage({ message: "What is the max level?" }, USER_ID);

    expect(result).toEqual({
      message: "The maximum level is...",
      model: "gemini-2.5-flash",
      provider: "gemini",
      conversationId: "conv-1",
    });

    const assistantMessageCall = mockMessageCreate.mock.calls.find((c) => c[1] === "assistant");
    expect(assistantMessageCall?.[2]).toBe("The maximum level is...");
  });

  it("resolves an existing conversation by id instead of creating a new one", async () => {
    mockConversationFindByIdForUser.mockResolvedValue({ id: "existing-conv", userId: USER_ID });

    const result = await chatService.sendMessage({
      message: "Hello",
      conversationId: "existing-conv",
    }, USER_ID);

    expect(mockConversationCreate).not.toHaveBeenCalled();
    expect(mockConversationFindByIdForUser).toHaveBeenCalledWith("existing-conv", USER_ID);
    expect(result.conversationId).toBe("existing-conv");
  });

  it("does not read or message a conversation owned by another user", async () => {
    mockConversationFindByIdForUser.mockResolvedValue(null);

    await expect(
      chatService.sendMessage({ message: "Private follow-up", conversationId: "other-conv" }, "user-other")
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(mockConversationFindByIdForUser).toHaveBeenCalledWith("other-conv", "user-other");
    expect(mockMessageFindRecent).not.toHaveBeenCalled();
    expect(mockMessageCreate).not.toHaveBeenCalled();
    expect(mockAgentRun).not.toHaveBeenCalled();
  });

  it("persists both turns when two requests concurrently target the same owned conversation", async () => {
    mockConversationFindByIdForUser.mockResolvedValue({ id: "shared-conv", userId: USER_ID });
    mockMessageFindRecent.mockResolvedValue([]);

    await Promise.all([
      chatService.sendMessage({ message: "first concurrent turn", conversationId: "shared-conv" }, USER_ID),
      chatService.sendMessage({ message: "second concurrent turn", conversationId: "shared-conv" }, USER_ID),
    ]);

    const roles = mockMessageCreate.mock.calls.map((call) => call[1]);
    expect(roles.filter((role) => role === "user")).toHaveLength(2);
    expect(roles.filter((role) => role === "assistant")).toHaveLength(2);
    expect(mockAgentRun).toHaveBeenCalledTimes(2);
  });
});
