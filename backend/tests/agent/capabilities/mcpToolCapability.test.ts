const mockRegistryExecute = jest.fn();

jest.mock("../../../src/mcp/registry", () => ({
  mcpRegistry: { execute: (...args: unknown[]) => mockRegistryExecute(...args) },
}));

// tools/index.ts (imported for its registration side effect by
// mcpToolCapability.ts) touches the real gameRepository/Prisma chain at
// module load time. Mock it here too so this test file never needs a
// generated Prisma client, consistent with how the rest of this project
// avoids Prisma-dependent test suites.
jest.mock("../../../src/mcp/tools", () => ({}));

import { matchToolInvocation, mcpToolCapability } from "../../../src/agent/capabilities/mcpToolCapability";

describe("matchToolInvocation", () => {
  it("matches a 'database information for X' request and extracts the game name", () => {
    const invocation = matchToolInvocation("Give me the database information for Elden Ring");
    expect(invocation).toEqual({ tool: "get_game_info", input: { title: "Elden Ring" } });
  });

  it("matches variants (info/information, for/on/about)", () => {
    expect(matchToolInvocation("database info on Dark Souls")).toEqual({
      tool: "get_game_info",
      input: { title: "Dark Souls" },
    });
    expect(matchToolInvocation("database information about Elden Ring?")).toEqual({
      tool: "get_game_info",
      input: { title: "Elden Ring" },
    });
  });

  it("matches natural phrasing variations for the same request", () => {
    expect(matchToolInvocation("database information for Dark Souls 3")).toEqual({
      tool: "get_game_info",
      input: { title: "Dark Souls 3" },
    });
    expect(matchToolInvocation("give me the DB info for Dark Souls 3")).toEqual({
      tool: "get_game_info",
      input: { title: "Dark Souls 3" },
    });
    expect(matchToolInvocation("what is Dark Souls 3 in the database?")).toEqual({
      tool: "get_game_info",
      input: { title: "Dark Souls 3" },
    });
    expect(matchToolInvocation("look up Dark Souls 3 in the database")).toEqual({
      tool: "get_game_info",
      input: { title: "Dark Souls 3" },
    });
    expect(matchToolInvocation("get the database record for Dark Souls 3")).toEqual({
      tool: "get_game_info",
      input: { title: "Dark Souls 3" },
    });
    expect(
      matchToolInvocation("Give me the database information for a game called Dark Souls 3")
    ).toEqual({
      tool: "get_game_info",
      input: { title: "Dark Souls 3" },
    });
  });

  it("returns null for a message that isn't a tool request", () => {
    expect(matchToolInvocation("Tell me about Elden Ring lore")).toBeNull();
    expect(matchToolInvocation("Hello")).toBeNull();
  });
});

describe("mcpToolCapability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("has the expected capability name", () => {
    expect(mcpToolCapability.name).toBe("mcp-tools");
  });

  it("succeeds with no context when the message doesn't match any known tool request", async () => {
    const result = await mcpToolCapability.execute({ message: "Hello", history: [] });

    expect(result).toEqual({ capability: "mcp-tools", succeeded: true });
    expect(mockRegistryExecute).not.toHaveBeenCalled();
  });

  it("calls mcpRegistry.execute with the matched tool and extracted input", async () => {
    mockRegistryExecute.mockResolvedValue({ success: true, data: { title: "Elden Ring" } });

    await mcpToolCapability.execute({
      message: "Give me the database information for Elden Ring",
      history: [],
    });

    expect(mockRegistryExecute).toHaveBeenCalledWith("get_game_info", { title: "Elden Ring" });
  });

  it("formats a successful tool result into readable context", async () => {
    mockRegistryExecute.mockResolvedValue({
      success: true,
      data: { title: "Elden Ring", developer: "FromSoftware", publisher: null },
    });

    const result = await mcpToolCapability.execute({
      message: "Give me the database information for Elden Ring",
      history: [],
    });

    expect(result.succeeded).toBe(true);
    expect(result.context).toContain("[Tool: get_game_info]");
    expect(result.context).toContain("title: Elden Ring");
    expect(result.context).toContain("developer: FromSoftware");
    expect(result.context).not.toContain("publisher"); // null fields are skipped
  });

  it("returns a controlled failure (succeeded: false) when the tool result is unsuccessful, without throwing", async () => {
    mockRegistryExecute.mockResolvedValue({
      success: false,
      error: 'No game found matching title "Some Unknown Game".',
    });

    const result = await mcpToolCapability.execute({
      message: "Give me the database information for Some Unknown Game",
      history: [],
    });

    expect(result.capability).toBe("mcp-tools");
    expect(result.succeeded).toBe(false);
    expect(result.context).toBeUndefined();
    expect(result.error).toContain("Some Unknown Game");
  });
});
