import { getLLMProvider } from "../services/ai";
import { SYSTEM_PROMPT } from "../services/ai/systemPrompt";
import { decide } from "./decisionEngine";
import { ragCapability } from "./capabilities/ragCapability";
import { mcpToolCapability } from "./capabilities/mcpToolCapability";
import {
  AgentContext,
  AgentInput,
  AgentResult,
  Capability,
  CapabilityResult,
} from "./types";
import { logger } from "../utils/logger";

// Maps each CapabilityName to its concrete implementation. Adding a new
// capability later means adding one entry here (and to
// decisionEngine.ts) — nothing else in the agent changes.
const CAPABILITIES: Record<string, Capability> = {
  "rag-search": ragCapability,
  "mcp-tools": mcpToolCapability,
};

// The agent: receives a user message + conversation history, decides
// what (if any) capabilities are needed, runs them, and calls the LLM
// with whatever context they produced. Provider-agnostic by construction
// — it only ever calls getLLMProvider()/provider.generateReply(), the
// same LLMProvider abstraction the rest of the project uses, so it knows
// nothing about Gemini specifically.
export const agentService = {
  async run(input: AgentInput): Promise<AgentResult> {
    logger.info("Agent started");

    const decision = decide(input);
    logger.info("Agent decision made", {
      capabilities: decision.capabilities,
      reason: decision.reason,
    });

    const capabilityResults: CapabilityResult[] = [];
    for (const name of decision.capabilities) {
      const capability = CAPABILITIES[name];
      if (!capability) continue; // unknown capability name — ignore rather than crash
      logger.info("Agent executing capability", { capability: name });
      capabilityResults.push(await capability.execute(input));
    }

    const context: AgentContext = { decision, capabilityResults };

    const provider = getLLMProvider();
    const result = await provider.generateReply({
      systemPrompt: SYSTEM_PROMPT,
      history: input.history,
      message: input.message,
      context: combineContext(capabilityResults),
    });

    logger.info("Agent completed", { provider: provider.name, model: result.model });

    return {
      message: result.content,
      model: result.model,
      provider: provider.name,
      context,
    };
  },
};

// Combines every capability's contributed context into one block for the
// LLM. A failed capability (succeeded: false) or one with nothing useful
// to add (context: undefined) simply contributes nothing — it does not
// block the other capabilities' contributions or the LLM call itself.
function combineContext(results: CapabilityResult[]): string | undefined {
  const pieces = results
    .filter((r): r is CapabilityResult & { context: string } => r.succeeded && !!r.context)
    .map((r) => r.context);
  return pieces.length > 0 ? pieces.join("\n\n") : undefined;
}

