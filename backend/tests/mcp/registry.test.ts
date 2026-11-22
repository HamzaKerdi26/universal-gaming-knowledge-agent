import { z } from "zod";
import { mcpRegistry } from "../../src/mcp/registry";
import { McpTool } from "../../src/mcp/types";

const fakeInputSchema = z.object({ name: z.string().min(1) });

function makeFakeTool(overrides: Partial<McpTool<{ name: string }>> = {}): McpTool<{ name: string }> {
  return {
    name: "fake-tool",
    description: "A fake tool for registry tests.",
    inputSchema: fakeInputSchema,
    execute: jest.fn().mockResolvedValue({ success: true, data: { echoed: "ok" } }),
    ...overrides,
  };
}

describe("mcpRegistry", () => {
  afterEach(() => {
    mcpRegistry.clear();
  });

  describe("register / list / get", () => {
    it("registers a tool and makes it discoverable via list()", () => {
      const tool = makeFakeTool();
      mcpRegistry.register(tool);

      expect(mcpRegistry.list()).toEqual([
        { name: "fake-tool", description: "A fake tool for registry tests." },
      ]);
    });

    it("looks up a registered tool by name", () => {
      const tool = makeFakeTool();
      mcpRegistry.register(tool);

      expect(mcpRegistry.get("fake-tool")).toBe(tool);
    });

    it("returns undefined for a tool that was never registered", () => {
      expect(mcpRegistry.get("does-not-exist")).toBeUndefined();
    });

    it("throws when registering two tools under the same name", () => {
      mcpRegistry.register(makeFakeTool());
      expect(() => mcpRegistry.register(makeFakeTool())).toThrow(
        /already registered/i
      );
    });

    it("list() reflects multiple registered tools", () => {
      mcpRegistry.register(makeFakeTool({ name: "tool-a", description: "A" }));
      mcpRegistry.register(makeFakeTool({ name: "tool-b", description: "B" }));

      expect(mcpRegistry.list().map((t) => t.name).sort()).toEqual(["tool-a", "tool-b"]);
    });
  });

  describe("execute", () => {
    it("returns a controlled failure for an unknown tool name", async () => {
      const result = await mcpRegistry.execute("nonexistent-tool", { name: "x" });

      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Unknown MCP tool"),
      });
    });

    it("validates input against the tool's schema before executing", async () => {
      const execute = jest.fn();
      mcpRegistry.register(makeFakeTool({ execute }));

      const result = await mcpRegistry.execute("fake-tool", { name: "" }); // fails min(1)

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid input");
      expect(execute).not.toHaveBeenCalled();
    });

    it("executes the tool with validated input and returns its result", async () => {
      const execute = jest.fn().mockResolvedValue({ success: true, data: { echoed: "hi" } });
      mcpRegistry.register(makeFakeTool({ execute }));

      const result = await mcpRegistry.execute("fake-tool", { name: "hi" });

      expect(execute).toHaveBeenCalledWith({ name: "hi" });
      expect(result).toEqual({ success: true, data: { echoed: "hi" } });
    });

    it("returns a controlled failure (does not throw) when the tool's execute() rejects", async () => {
      const execute = jest.fn().mockRejectedValue(new Error("boom"));
      mcpRegistry.register(makeFakeTool({ execute }));

      const result = await mcpRegistry.execute("fake-tool", { name: "hi" });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Tool "fake-tool" failed to execute');
      // The raw error message is logged, not exposed in the result.
      expect(result.error).not.toContain("boom");
    });
  });
});
