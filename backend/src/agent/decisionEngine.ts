import { AgentDecision, AgentInput } from "./types";
import { matchToolInvocation } from "./capabilities/mcpToolCapability";

// Phase 6 deliberately uses simple, deterministic pattern matching rather
// than an LLM-based planner — the requirement is "can the agent decide
// when retrieval is needed," not "build an autonomous planner." The
// default leans toward retrieval (most gaming questions benefit from it,
// and a wrong "try RAG" costs a Qdrant query rather than a wrong answer),
// with a short-circuit for obvious small talk that clearly isn't a
// knowledge question, to avoid a wasted retrieval call on every "hi" or
// "thanks."
//
// Kept as a plain, synchronous `(input) => AgentDecision` function on
// purpose: swapping this out for an LLM-based planner later (e.g. asking
// the model itself which capabilities apply) only means changing this
// function's implementation — and, if that planner needs to be async,
// making agent.service.ts `await` this call — nothing else in the agent
// or capabilities needs to change.
const SMALL_TALK_PATTERNS: RegExp[] = [
  /^(hi|hello|hey|yo|sup|howdy)[!.?]*$/i,
  /^(thanks|thank you|thx|ty|appreciate it)[!.?]*$/i,
  /^(bye|goodbye|see ya|see you|later)[!.?]*$/i,
  /^how are you([?!.]*)$/i,
  /^(ok|okay|cool|nice|great|got it|sounds good)[!.?]*$/i,
];

export function decide(input: AgentInput): AgentDecision {
  const trimmed = input.message.trim();

  if (SMALL_TALK_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return {
      capabilities: [],
      reason: "Message looks like small talk rather than a knowledge question — skipping retrieval.",
    };
  }

  // Phase 7: a request for structured database/game info ("give me the
  // database information for Elden Ring") should use the mcp-tools
  // capability instead of RAG — reuses mcpToolCapability's own matcher so
  // the "does this look like a tool request" pattern lives in exactly
  // one place, not duplicated between the decision engine and the
  // capability that acts on it.
  if (matchToolInvocation(trimmed)) {
    return {
      capabilities: ["mcp-tools"],
      reason: "Message looks like a request for structured game data — using an MCP tool instead of RAG.",
    };
  }

  return {
    capabilities: ["rag-search"],
    reason: "Message may be a gaming knowledge question — trying RAG retrieval.",
  };
}
