import { DataSource, SourceType } from "./types";

// In-memory registry of available data sources. New sources register
// here (see index.ts) and become discoverable/usable without any other
// file needing to change — dataSourceService only ever depends on this
// registry, never on a specific source's implementation.
//
// Unlike the LLM/embedding provider factories (which pick ONE active
// provider via env config), this is a registry of MULTIPLE
// simultaneously-available sources — a search/import request names
// which one it wants (e.g. "rawg" vs "wikipedia").
const sources = new Map<string, DataSource>();

export const dataSourceRegistry = {
  register(source: DataSource): void {
    if (sources.has(source.name)) {
      throw new Error(`A data source named "${source.name}" is already registered`);
    }
    sources.set(source.name, source);
  },

  list(): Array<{ name: string; sourceType: SourceType }> {
    return Array.from(sources.values()).map((s) => ({
      name: s.name,
      sourceType: s.sourceType,
    }));
  },

  get(name: string): DataSource | undefined {
    return sources.get(name);
  },

  // Exposed for tests only, so each test file can start from a clean
  // registry instead of accumulating sources registered by other
  // modules' side-effect imports.
  clear(): void {
    sources.clear();
  },
};
