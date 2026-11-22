# Known Issues

Tracked issues deliberately deferred to the final hardening pass after
Phase 10, rather than fixed piecemeal mid-phase.

## MCP natural-language database-request detection is incomplete

**Found:** during Phase 8 kickoff (reported by the user).

**Symptom:** `src/agent/capabilities/mcpToolCapability.ts`'s deterministic
`matchToolInvocation()` pattern-matcher does not recognize all natural
phrasings of a request for structured game data. Confirmed working:

- "Give me the database information for Elden Ring"
- "database information for Dark Souls 3"
- "give me the DB info for Dark Souls 3"
- "what is Dark Souls 3 in the database?"
- "look up Dark Souls 3 in the database"
- "get the database record for Dark Souls 3"
- "Give me the database information for a game called Dark Souls 3"

Not currently detected (falls back to the RAG/normal-conversation path
instead of triggering the `get_game_info` MCP tool):

- "Can you get the database record for Dark Souls 3?"

**Root cause (preliminary):** the two `TOOL_REQUEST_PATTERNS` regexes are
anchored/shaped around specific phrasings; a polite/indirect framing like
"Can you get..." isn't covered by either pattern's expected sentence
shape.

**Deliberately not fixed now:** per explicit instruction, this is
deferred to the final hardening pass after Phase 10, rather than being
patched incrementally each time a new phrasing gap is found. A single
consolidated pass over the matcher (or a decision to replace it with
something more robust) is more appropriate than repeated narrow regex
patches.

**Where to look when fixing:** `src/agent/capabilities/mcpToolCapability.ts`
(`TOOL_REQUEST_PATTERNS`, `matchToolInvocation`), with test coverage in
`tests/agent/capabilities/mcpToolCapability.test.ts` and
`tests/agent/decisionEngine.test.ts`.
