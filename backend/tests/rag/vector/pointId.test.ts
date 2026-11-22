import { deterministicPointId } from "../../../src/rag/vector/pointId";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("deterministicPointId", () => {
  it("produces a validly formatted UUID v5 string", () => {
    const id = deterministicPointId("elden-ring-combat", 0);
    expect(id).toMatch(UUID_RE);
  });

  it("is deterministic: same documentId + chunkIndex always produces the same id", () => {
    const a = deterministicPointId("elden-ring-combat", 3);
    const b = deterministicPointId("elden-ring-combat", 3);
    expect(a).toBe(b);
  });

  it("produces different ids for different chunk indexes of the same document", () => {
    const a = deterministicPointId("elden-ring-combat", 0);
    const b = deterministicPointId("elden-ring-combat", 1);
    expect(a).not.toBe(b);
  });

  it("produces different ids for different documents at the same chunk index", () => {
    const a = deterministicPointId("elden-ring-combat", 0);
    const b = deterministicPointId("elden-ring-lore", 0);
    expect(a).not.toBe(b);
  });

  it("is stable across repeated calls in a loop (no hidden randomness)", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 5; i++) {
      ids.add(deterministicPointId("dark-souls-overview", 2));
    }
    expect(ids.size).toBe(1);
  });
});
