import { ChatTurn } from "../services/ai/llmProvider";

// What the caller (chat.service.ts) hands to the agent for one turn.
// Deliberately minimal — the agent doesn't need to know about
// conversation ids, persistence, or HTTP concerns; that stays in
// chat.service.ts.
export interface AgentInput {
  message: string;
  history: ChatTurn[];
}

// Identifies an available capability. Adding a new capability later
// means adding one new name here, one new file under capabilities/, and
// one new entry in each of decisionEngine.ts and agent.service.ts's
// capability registry — nothing else in the agent changes.
//
// "mcp-tools" (Phase 7) is deliberately one generic capability rather
// than one CapabilityName per individual MCP tool — new MCP tools
// register themselves in src/mcp/tools/ and get picked up by that one
// capability, so adding tool #2, #3, etc. later doesn't mean adding more
// CapabilityNames or touching agent.service.ts/decisionEngine.ts's
// capability wiring again.
export type CapabilityName = "rag-search" | "mcp-tools";

// What a capability returns after running. Capabilities never call the
// LLM themselves — they only gather information for the agent to hand to
// the LLM afterward, and never throw: a failure is reported back as
// `succeeded: false` so the agent can decide how to proceed (see
// agent.service.ts's combineContext).
export interface CapabilityResult {
  capability: CapabilityName;
  succeeded: boolean;
  // Text this capability contributes to the LLM prompt (e.g. formatted
  // retrieved chunks). Undefined when the capability ran successfully but
  // found nothing useful — that's different from failure.
  context?: string;
  // Present only when succeeded is false. Logged, never shown to the
  // end user or forwarded into the LLM prompt.
  error?: string;
}

// A capability the agent can choose to run for a given turn. Every
// concrete capability (RAG today) implements this the same small-interface
// way LLMProvider/EmbeddingProvider are implemented elsewhere in this
// project, so the agent never depends on a capability's internals.
export interface Capability {
  readonly name: CapabilityName;
  execute(input: AgentInput): Promise<CapabilityResult>;
}

// The agent's decision about which capabilities (if any) to run for this
// turn. Deliberately produced by simple, deterministic logic for Phase 6
// — see decisionEngine.ts's doc comment for how this is meant to evolve
// into an LLM-based planner later without changing this shape.
export interface AgentDecision {
  capabilities: CapabilityName[];
  reason: string;
}

// Everything the agent gathered before calling the LLM — kept internally
// available (e.g. for logging or future debugging endpoints) but not
// part of the public /api/chat response shape, which only exposes
// message/model/provider/conversationId as before.
export interface AgentContext {
  decision: AgentDecision;
  capabilityResults: CapabilityResult[];
}

export interface AgentResult {
  message: string;
  model: string;
  provider: string;
  context: AgentContext;
}
