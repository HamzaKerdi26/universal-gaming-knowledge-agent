import { ZodType } from "zod";

// A single MCP-style tool: a name, description, a Zod schema describing
// its input, and an execute function. Modeled closely on the Model
// Context Protocol's core tool contract (name / description / input
// schema / execute -> structured result), but deliberately without the
// full MCP client/server transport (stdio, SSE, JSON-RPC) — that's built
// for out-of-process tool servers, which is unnecessary complexity here
// for one in-process, locally-executed tool. Keeping this shape close to
// the real protocol means adopting the official SDK later (if a tool
// ever needs to run out-of-process) means adapting this interface, not
// redesigning how the agent calls tools.
export interface McpTool<TInput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ZodType<TInput>;
  execute(input: TInput): Promise<McpToolResult>;
}

// What a tool returns. Structured, not free text — the agent/capability
// layer formats this into an LLM-readable block; the tool itself only
// knows about its own domain (e.g. "here's a Game row, or a clean
// not-found reason"), never about prompts or the LLM.
export interface McpToolResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}
