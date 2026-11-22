import "../../mcp/tools"; // side-effect: registers all built-in MCP tools
import { mcpRegistry } from "../../mcp/registry";
import { logger } from "../../utils/logger";
import { AgentInput, Capability, CapabilityResult } from "../types";

// Bridges the agent to the MCP tool layer (src/mcp/). Rather than giving
// every individual MCP tool its own CapabilityName, this one capability
// owns "which registered tool, if any, applies to this message, and
// with what input" — a new MCP tool registers itself in src/mcp/tools/
// and is picked up here with one added match branch, without touching
// agent.service.ts or decisionEngine.ts's capability wiring.
export const mcpToolCapability: Capability = {
  name: "mcp-tools",

  async execute(input: AgentInput): Promise<CapabilityResult> {
    const invocation = matchToolInvocation(input.message);
    if (!invocation) {
      // The decision engine believed an MCP tool might apply, but no
      // specific registered tool actually matched this message. Not an
      // error — this capability just has nothing to contribute.
      return { capability: "mcp-tools", succeeded: true };
    }

    const result = await mcpRegistry.execute(invocation.tool, invocation.input);

    logger.info("MCP tool executed", {
      tool: invocation.tool,
      success: result.success,
    });

    if (!result.success) {
      // Same convention as ragCapability: a failed tool call is a
      // controlled result, not a thrown error — the agent simply
      // contributes no context from this capability and still calls the
      // LLM. The failure reason is logged above, not surfaced to the
      // end user or the LLM prompt.
      return { capability: "mcp-tools", succeeded: false, error: result.error };
    }

    return {
      capability: "mcp-tools",
      succeeded: true,
      context: formatToolResult(invocation.tool, result.data),
    };
  },
};

interface ToolInvocation {
  tool: string;
  input: unknown;
}

// Minimal, deterministic matcher: recognizes a request for structured
// database/game info and extracts the game name. Intentionally simple —
// exported so decisionEngine.ts can reuse this exact check rather than
// duplicating the pattern to decide whether "mcp-tools" applies at all.
// Meant to be swapped for something smarter (e.g. an LLM-based tool
// planner) later without changing this function's signature or how
// agent.service.ts/decisionEngine.ts call into this capability.
//
// Two deliberately simple sentence shapes are recognized, covering the
// natural phrasings people actually use for "look this up in the DB"
// rather than one rigid phrase:
//   A) "<database|db> ... <info|information|record(s)|details|data|entry(ies)> (for|on|about) [a game (called|named)] <name>"
//      e.g. "database information for X", "DB info on X",
//      "database record for a game called X"
//   B) "[look up|what is|what's|find|search for] <name> in the <database|db>"
//      e.g. "look up X in the database", "what is X in the database?"
const TOOL_REQUEST_PATTERNS: RegExp[] = [
  /\b(?:db|database)\b.*?\b(?:info|information|records?|details|data|entr(?:y|ies))\b\s*(?:for|on|about)\s+(?:a game (?:called|named)\s+)?(.+)/i,
  /^(?:look up|what is|what's|find|search for)?\s*(.+?)\s+in the (?:db|database)\b/i,
];

export function matchToolInvocation(message: string): ToolInvocation | null {
  for (const pattern of TOOL_REQUEST_PATTERNS) {
    const match = message.match(pattern);
    if (!match) continue;

    const title = match[1].trim().replace(/[?.!]+$/, "").trim();
    if (title) return { tool: "get_game_info", input: { title } };
  }

  return null;
}

function formatToolResult(
  toolName: string,
  data: Record<string, unknown> | undefined
): string {
  if (!data) return `[Tool: ${toolName}]\nNo structured data returned.`;

  const lines = [`[Tool: ${toolName}]`];
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;
    lines.push(`${key}: ${value}`);
  }
  return lines.join("\n");
}
