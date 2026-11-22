const mockRagSearch = jest.fn();

jest.mock("../../../src/services/rag.service", () => ({
  ragService: { search: (...args: unknown[]) => mockRagSearch(...args) },
}));

import { ragCapability } from "../../../src/agent/capabilities/ragCapability";

describe("ragCapability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("has the expected capability name", () => {
    expect(ragCapability.name).toBe("rag-search");
  });

  it("searches ragService with the agent input's message", async () => {
    mockRagSearch.mockResolvedValue([]);

    await ragCapability.execute({ message: "How does combat work in Elden Ring?", history: [] });

    expect(mockRagSearch).toHaveBeenCalledWith({
      query: "How does combat work in Elden Ring?",
    });
  });

  it("succeeds with formatted context when results are found", async () => {
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

    const result = await ragCapability.execute({ message: "combat?", history: [] });

    expect(result.capability).toBe("rag-search");
    expect(result.succeeded).toBe(true);
    expect(result.context).toContain("RETRIEVED GAMING KNOWLEDGE:");
    expect(result.context).toContain("[Source 1]");
    expect(result.context).toContain("Game: elden-ring");
    expect(result.context).toContain("Category: combat");
    expect(result.context).toContain("Title: Elden Ring Combat");
    expect(result.context).toContain("Combat is stamina-driven and deliberate.");
  });

  it("succeeds with undefined context when there are no results", async () => {
    mockRagSearch.mockResolvedValue([]);

    const result = await ragCapability.execute({ message: "hello", history: [] });

    expect(result.succeeded).toBe(true);
    expect(result.context).toBeUndefined();
  });

  it("returns a controlled failure result (does not throw) when ragService.search rejects", async () => {
    mockRagSearch.mockRejectedValue(new Error("Qdrant unreachable"));

    const result = await ragCapability.execute({ message: "combat?", history: [] });

    expect(result.capability).toBe("rag-search");
    expect(result.succeeded).toBe(false);
    expect(result.context).toBeUndefined();
    expect(result.error).toContain("Qdrant unreachable");
  });

  it("formats multiple sources in order", async () => {
    mockRagSearch.mockResolvedValue([
      {
        score: 0.9,
        chunkId: "c1",
        documentId: "d1",
        gameSlug: "elden-ring",
        category: "combat",
        title: "Combat",
        content: "Content one.",
        chunkIndex: 0,
      },
      {
        score: 0.8,
        chunkId: "c2",
        documentId: "d2",
        gameSlug: "elden-ring",
        category: "lore",
        title: "Lore",
        content: "Content two.",
        chunkIndex: 0,
      },
    ]);

    const result = await ragCapability.execute({ message: "elden ring", history: [] });

    expect(result.context).toContain("[Source 1]");
    expect(result.context).toContain("[Source 2]");
    expect(result.context?.indexOf("[Source 1]")).toBeLessThan(
      result.context?.indexOf("[Source 2]") ?? -1
    );
  });
});
