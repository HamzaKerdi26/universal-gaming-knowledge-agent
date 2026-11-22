// decisionEngine.ts calls matchToolInvocation from mcpToolCapability.ts,
// which side-effect-imports mcp/tools/index.ts to register the real
// get_game_info tool — and that tool imports gameRepository, which
// touches @prisma/client. Mocked here (as an empty module) purely to
// avoid that transitive Prisma dependency in this test file; decide()
// itself never calls the registry, only the pure matchToolInvocation
// pattern-matcher, so this has no effect on what's actually being tested.
jest.mock("../../src/mcp/tools", () => ({}));

import { decide } from "../../src/agent/decisionEngine";

describe("decisionEngine.decide", () => {
  it("selects the rag-search capability for a gaming knowledge question", () => {
    const decision = decide({
      message: "How does combat work in Elden Ring?",
      history: [],
    });

    expect(decision.capabilities).toEqual(["rag-search"]);
    expect(decision.reason).toEqual(expect.any(String));
  });

  it("selects no capabilities for small talk / greetings", () => {
    for (const message of ["hi", "Hello!", "thanks", "bye", "ok"]) {
      const decision = decide({ message, history: [] });
      expect(decision.capabilities).toEqual([]);
    }
  });

  it("selects rag-search for a question that mentions no specific game but is still a knowledge question", () => {
    const decision = decide({ message: "What is a roguelike?", history: [] });
    expect(decision.capabilities).toEqual(["rag-search"]);
  });

  it("selects the mcp-tools capability for a request for structured database/game info", () => {
    const decision = decide({
      message: "Give me the database information for Elden Ring",
      history: [],
    });

    expect(decision.capabilities).toEqual(["mcp-tools"]);
    expect(decision.reason).toEqual(expect.any(String));
  });

  it("prefers mcp-tools over rag-search when a message matches a tool request", () => {
    const decision = decide({ message: "database info on Dark Souls", history: [] });
    expect(decision.capabilities).toEqual(["mcp-tools"]);
  });

  it("selects mcp-tools for natural phrasing variations of a database-info request", () => {
    const variations = [
      "database information for Dark Souls 3",
      "give me the DB info for Dark Souls 3",
      "what is Dark Souls 3 in the database?",
      "look up Dark Souls 3 in the database",
      "get the database record for Dark Souls 3",
      "Give me the database information for a game called Dark Souls 3",
    ];

    for (const message of variations) {
      const decision = decide({ message, history: [] });
      expect(decision.capabilities).toEqual(["mcp-tools"]);
    }
  });

  it("is case-insensitive and tolerant of trailing punctuation for small talk", () => {
    const decision = decide({ message: "  THANKS!!  ", history: [] });
    expect(decision.capabilities).toEqual([]);
  });

  it("always returns a non-empty reason string", () => {
    const withRag = decide({ message: "Tell me about Dark Souls lore", history: [] });
    const withoutRag = decide({ message: "hello", history: [] });
    expect(withRag.reason.length).toBeGreaterThan(0);
    expect(withoutRag.reason.length).toBeGreaterThan(0);
  });
});
