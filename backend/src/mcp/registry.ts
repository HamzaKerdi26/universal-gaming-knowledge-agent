import { McpTool, McpToolResult } from "./types";
import { logger } from "../utils/logger";

// In-memory registry of available MCP-style tools. New tools register
// here (see tools/index.ts) and become available to the agent without
// any other file needing to change — the agent's capability layer only
// ever depends on this registry, never on a specific tool's internals.
const tools = new Map<string, McpTool>();

export const mcpRegistry = {
  // Throws synchronously on a duplicate name — this is a programmer
  // error caught at module-load time (two tools registered under the
  // same name), not a runtime/user-facing condition, so it's fine for it
  // to fail fast rather than return a controlled result.
  register(tool: McpTool): void {
    if (tools.has(tool.name)) {
      throw new Error(`An MCP tool named "${tool.name}" is already registered`);
    }
    tools.set(tool.name, tool);
  },

  list(): Array<{ name: string; description: string }> {
    return Array.from(tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
    }));
  },

  get(name: string): McpTool | undefined {
    return tools.get(name);
  },

  // Validates raw input against the tool's own schema, then executes it.
  // Never throws for any expected failure mode (unknown tool name,
  // invalid input, or the tool's execute() rejecting) — always returns a
  // controlled McpToolResult, matching the same "never throw, return a
  // controlled result" convention agent/capabilities already use for RAG.
  async execute(name: string, rawInput: unknown): Promise<McpToolResult> {
    const tool = tools.get(name);
    if (!tool) {
      return { success: false, error: `Unknown MCP tool: "${name}"` };
    }

    const parsed = tool.inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const details = parsed.error.issues
        .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
        .join("; ");
      return { success: false, error: `Invalid input for tool "${name}": ${details}` };
    }

    try {
      return await tool.execute(parsed.data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("MCP tool execution failed", { tool: name, message });
      return { success: false, error: `Tool "${name}" failed to execute.` };
    }
  },

  // Exposed for tests only, so each test file can start from a clean
  // registry instead of accumulating tools registered by other modules'
  // side-effect imports.
  clear(): void {
    tools.clear();
  },
};
