import { ragService } from "../../services/rag.service";
import { SearchResultItem } from "../../rag/search/types";
import { logger } from "../../utils/logger";
import { AgentInput, Capability, CapabilityResult } from "../types";

// The agent's first capability: gaming-knowledge retrieval via the
// existing Phase 5 RAG stack. This is a thin wrapper only — the actual
// retrieval logic (query embedding, Qdrant similarity search) still
// lives entirely in ragService/searchService/vectorStore exactly as
// Phase 5 built it. Nothing here duplicates that; this file only adds
// the agent-facing Capability interface and prompt-formatting on top.
//
// This is also where the RAG-context-building logic that used to live
// directly in chat.service.ts (Phase 5.5) now lives — moved, not
// duplicated, now that chat.service.ts delegates to the agent instead of
// orchestrating RAG itself.
export const ragCapability: Capability = {
  name: "rag-search",

  async execute(input: AgentInput): Promise<CapabilityResult> {
    try {
      const results = await ragService.search({ query: input.message });

      logger.info("RAG capability executed", {
        resultsCount: results.length,
        topScore: results[0]?.score,
        games: [...new Set(results.map((r) => r.gameSlug))],
      });

      return {
        capability: "rag-search",
        succeeded: true,
        context: buildRagContext(results),
      };
    } catch (err) {
      // Never throw out of a capability — a failed capability is a
      // controlled result the agent can decide how to handle (see
      // agent.service.ts's combineContext), not a crash. The failure is
      // still logged at error level so it stays visible to operators.
      const message = err instanceof Error ? err.message : String(err);
      logger.error("RAG capability failed", { message });
      return { capability: "rag-search", succeeded: false, error: message };
    }
  },
};

function buildRagContext(results: SearchResultItem[]): string | undefined {
  if (results.length === 0) return undefined;

  const sources = results
    .map((r, index) => {
      const lines = [`[Source ${index + 1}]`, `Game: ${r.gameSlug}`];
      if (r.category) lines.push(`Category: ${r.category}`);
      lines.push(`Title: ${r.title}`, "Content:", r.content);
      return lines.join("\n");
    })
    .join("\n\n");

  return `RETRIEVED GAMING KNOWLEDGE:\n\n${sources}`;
}
