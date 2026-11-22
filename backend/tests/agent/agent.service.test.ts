const mockRagSearch = jest.fn();
const mockGenerateReply = jest.fn();
const mockGetLLMProvider = jest.fn();
const mockMcpRegistryExecute = jest.fn();

jest.mock("../../src/services/rag.service", () => ({
  ragService: { search: (...args: unknown[]) => mockRagSearch(...args) },
}));

jest.mock("../../src/services/ai", () => ({
  getLLMProvider: () => mockGetLLMProvider(),
}));

jest.mock("../../src/mcp/registry", () => ({
  mcpRegistry: { execute: (...args: unknown[]) => mockMcpRegistryExecute(...args) },
}));

// mcpToolCapability.ts side-effect-imports mcp/tools/index.ts to register
// the real get_game_info tool, which touches gameRepository/@prisma/client.
// Mocked as an empty module so this suite never needs a generated Prisma
// client — mcpRegistry itself is already mocked above, so no tool
// actually needs to be registered for these tests to exercise the real
// decision + capability-dispatch logic.
jest.mock("../../src/mcp/tools", () => ({}));

import { agentService } from "../../src/agent/agent.service";
import { logger } from "../../src/utils/logger";

describe("agentService.run", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetLLMProvider.mockReturnValue({
      name: "gemini",
      generateReply: mockGenerateReply,
    });
    mockGenerateReply.mockResolvedValue({ content: "A reply.", model: "gemini-2.5-flash" });
  });

  it("1. processes a gaming knowledge question end-to-end", async () => {
    mockRagSearch.mockResolvedValue([
      {
        score: 0.91,
        chunkId: "elden-ring-combat-chunk-0",
        documentId: "elden-ring-combat",
        gameSlug: "elden-ring",
        category: "combat",
        title: "Elden Ring Combat",
        content: "Combat is stamina-driven.",
        chunkIndex: 0,
      },
    ]);

    const result = await agentService.run({
      message: "How does combat work in Elden Ring?",
      history: [],
    });

    expect(result.message).toBe("A reply.");
    expect(result.model).toBe("gemini-2.5-flash");
    expect(result.provider).toBe("gemini");
  });

  it("2. selects the rag-search capability for a knowledge question (agent decision)", async () => {
    mockRagSearch.mockResolvedValue([]);

    const result = await agentService.run({
      message: "How does combat work in Elden Ring?",
      history: [],
    });

    expect(result.context.decision.capabilities).toEqual(["rag-search"]);
  });

  it("3. actually runs the RAG capability (ragService.search is called) before the LLM", async () => {
    const callOrder: string[] = [];
    mockRagSearch.mockImplementation(async () => {
      callOrder.push("search");
      return [];
    });
    mockGenerateReply.mockImplementation(async () => {
      callOrder.push("generateReply");
      return { content: "A reply.", model: "gemini-2.5-flash" };
    });

    await agentService.run({ message: "How does combat work?", history: [] });

    expect(mockRagSearch).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(["search", "generateReply"]);
  });

  it("4. retrieved context reaches the LLM via input.context", async () => {
    mockRagSearch.mockResolvedValue([
      {
        score: 0.91,
        chunkId: "elden-ring-combat-chunk-0",
        documentId: "elden-ring-combat",
        gameSlug: "elden-ring",
        category: "combat",
        title: "Elden Ring Combat",
        content: "Combat is stamina-driven and deliberate.",
        chunkIndex: 0,
      },
    ]);

    await agentService.run({ message: "How does combat work in Elden Ring?", history: [] });

    const generateReplyInput = mockGenerateReply.mock.calls[0][0];
    expect(generateReplyInput.context).toContain("RETRIEVED GAMING KNOWLEDGE:");
    expect(generateReplyInput.context).toContain("Combat is stamina-driven and deliberate.");
  });

  it("5. answers without RAG when retrieval is not required (small talk skips the capability)", async () => {
    const result = await agentService.run({ message: "hi", history: [] });

    expect(result.context.decision.capabilities).toEqual([]);
    expect(mockRagSearch).not.toHaveBeenCalled();

    const generateReplyInput = mockGenerateReply.mock.calls[0][0];
    expect(generateReplyInput.context).toBeUndefined();
    expect(mockGenerateReply).toHaveBeenCalledTimes(1); // LLM is still called
  });

  it("6. handles RAG failure gracefully — LLM is still called, without context, agent doesn't throw", async () => {
    mockRagSearch.mockRejectedValue(new Error("Qdrant unreachable"));

    const result = await agentService.run({ message: "How does combat work?", history: [] });

    expect(result.message).toBe("A reply.");
    expect(result.context.capabilityResults[0]).toMatchObject({
      capability: "rag-search",
      succeeded: false,
    });

    const generateReplyInput = mockGenerateReply.mock.calls[0][0];
    expect(generateReplyInput.context).toBeUndefined();
  });

  it("7. preserves conversation history — passed through to the LLM unchanged", async () => {
    mockRagSearch.mockResolvedValue([]);
    const history = [
      { role: "user" as const, content: "Hi" },
      { role: "assistant" as const, content: "Hello!" },
    ];

    await agentService.run({ message: "Follow up question", history });

    const generateReplyInput = mockGenerateReply.mock.calls[0][0];
    expect(generateReplyInput.history).toEqual(history);
  });

  it("8. never mutates the original user message — input.message reaches the LLM unchanged", async () => {
    mockRagSearch.mockResolvedValue([
      {
        score: 0.8,
        chunkId: "c1",
        documentId: "d1",
        gameSlug: "elden-ring",
        category: "lore",
        title: "Lore",
        content: "Some lore.",
        chunkIndex: 0,
      },
    ]);

    await agentService.run({ message: "Tell me about the lore", history: [] });

    const generateReplyInput = mockGenerateReply.mock.calls[0][0];
    expect(generateReplyInput.message).toBe("Tell me about the lore");
    expect(generateReplyInput.message).not.toContain("RETRIEVED GAMING KNOWLEDGE");
  });

  it("9. remains provider-agnostic — only calls getLLMProvider()/generateReply(), never references Gemini directly", async () => {
    mockRagSearch.mockResolvedValue([]);
    const fakeProviderName = "some-other-provider";
    mockGetLLMProvider.mockReturnValue({
      name: fakeProviderName,
      generateReply: mockGenerateReply,
    });
    mockGenerateReply.mockResolvedValue({ content: "reply", model: "some-model" });

    const result = await agentService.run({ message: "hello", history: [] });

    expect(mockGetLLMProvider).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe(fakeProviderName);
    expect(result.model).toBe("some-model");
  });

  it("still includes the static system prompt on every call", async () => {
    mockRagSearch.mockResolvedValue([]);
    await agentService.run({ message: "hello", history: [] });

    const generateReplyInput = mockGenerateReply.mock.calls[0][0];
    expect(generateReplyInput.systemPrompt).toContain("Universal Gaming Knowledge Agent");
  });

  it("does not include user prompt content in agent logs", async () => {
    mockRagSearch.mockResolvedValue([]);
    const prompt = "private-prompt-marker-should-never-be-logged";
    const infoSpy = jest.spyOn(logger, "info").mockImplementation(() => undefined);

    try {
      await agentService.run({ message: prompt, history: [] });
      expect(JSON.stringify(infoSpy.mock.calls)).not.toContain(prompt);
    } finally {
      infoSpy.mockRestore();
    }
  });

  it("10. selects the mcp-tools capability for a structured database-info request, not RAG", async () => {
    mockMcpRegistryExecute.mockResolvedValue({
      success: true,
      data: { title: "Elden Ring", developer: "FromSoftware" },
    });

    const result = await agentService.run({
      message: "Give me the database information for Elden Ring",
      history: [],
    });

    expect(result.context.decision.capabilities).toEqual(["mcp-tools"]);
    expect(mockRagSearch).not.toHaveBeenCalled();
  });

  it("11. executes the MCP tool via the registry with the extracted input", async () => {
    mockMcpRegistryExecute.mockResolvedValue({ success: true, data: { title: "Elden Ring" } });

    await agentService.run({
      message: "Give me the database information for Elden Ring",
      history: [],
    });

    expect(mockMcpRegistryExecute).toHaveBeenCalledWith("get_game_info", {
      title: "Elden Ring",
    });
  });

  it("12. MCP tool result reaches the LLM as context", async () => {
    mockMcpRegistryExecute.mockResolvedValue({
      success: true,
      data: { title: "Elden Ring", developer: "FromSoftware" },
    });

    await agentService.run({
      message: "Give me the database information for Elden Ring",
      history: [],
    });

    const generateReplyInput = mockGenerateReply.mock.calls[0][0];
    expect(generateReplyInput.context).toContain("[Tool: get_game_info]");
    expect(generateReplyInput.context).toContain("title: Elden Ring");
    expect(generateReplyInput.context).toContain("developer: FromSoftware");
  });

  it("13. handles an MCP tool-not-found result gracefully — LLM still called, without context", async () => {
    mockMcpRegistryExecute.mockResolvedValue({
      success: false,
      error: 'No game found matching title "Some Unknown Game".',
    });

    const result = await agentService.run({
      message: "Give me the database information for Some Unknown Game",
      history: [],
    });

    expect(result.message).toBe("A reply.");
    expect(result.context.capabilityResults[0]).toMatchObject({
      capability: "mcp-tools",
      succeeded: false,
    });

    const generateReplyInput = mockGenerateReply.mock.calls[0][0];
    expect(generateReplyInput.context).toBeUndefined();
  });

  it("14. RAG still works unaffected by the presence of MCP tools", async () => {
    mockRagSearch.mockResolvedValue([
      {
        score: 0.9,
        chunkId: "c1",
        documentId: "elden-ring-lore",
        gameSlug: "elden-ring",
        category: "lore",
        title: "Elden Ring Lore",
        content: "The Shattering...",
        chunkIndex: 0,
      },
    ]);

    const result = await agentService.run({
      message: "Tell me about Elden Ring lore",
      history: [],
    });

    expect(result.context.decision.capabilities).toEqual(["rag-search"]);
    expect(mockMcpRegistryExecute).not.toHaveBeenCalled();

    const generateReplyInput = mockGenerateReply.mock.calls[0][0];
    expect(generateReplyInput.context).toContain("RETRIEVED GAMING KNOWLEDGE:");
  });

  it("15. normal conversation still uses neither RAG nor MCP", async () => {
    const result = await agentService.run({ message: "thanks!", history: [] });

    expect(result.context.decision.capabilities).toEqual([]);
    expect(mockRagSearch).not.toHaveBeenCalled();
    expect(mockMcpRegistryExecute).not.toHaveBeenCalled();
    expect(result.message).toBe("A reply.");
  });
});
