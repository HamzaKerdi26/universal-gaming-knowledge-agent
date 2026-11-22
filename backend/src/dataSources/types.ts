// Phase 8's data source abstraction. A DataSource is anything that can
// be searched and can produce a canonical GameSourceRecord for a given
// external id — a structured game-data API (RAWG), a knowledge/wiki
// source (Wikipedia), and later (not implemented yet, but supported by
// this shape) Reddit, Discord, or an arbitrary web source. Every source
// is registered once (see registry.ts) and the rest of the app only ever
// talks to sources through this interface — never a provider-specific
// response shape.
export enum SourceType {
  API = "API",
  WIKI = "WIKI",
  REDDIT = "REDDIT",
  DISCORD = "DISCORD",
  WEB = "WEB",
}

// The canonical shape every source normalizes its data into. Not every
// field applies to every source type — a wiki article has no
// developer/publisher, and a structured game-data API record has no
// long-form `content` body the way an article or forum post does.
// `title`/`slug`/`externalId`/`source`/`sourceType`/`retrievedAt` are the
// only fields every record needs regardless of where it came from.
export interface GameSourceRecord {
  title: string;
  slug: string;
  // Short summary, when the source has one (an API's blurb, a wiki
  // article's lead paragraph).
  description?: string;
  // Longer free-text body used as the primary RAG ingestion content for
  // knowledge/community sources (full wiki article text, a post body).
  // Structured API sources typically leave this unset and rely on
  // description + the structured fields below instead.
  content?: string;
  developer?: string;
  publisher?: string;
  releaseDate?: string; // ISO date string
  genres?: string[];
  platforms?: string[];
  imageUrl?: string;
  externalId: string;
  source: string; // registry key of the source that produced this, e.g. "rawg", "wikipedia"
  sourceType: SourceType;
  sourceUrl?: string;
  retrievedAt: string; // ISO timestamp, set by the source at fetch time
}

export interface SourceSearchResult {
  externalId: string;
  title: string;
  sourceUrl?: string;
}

export interface DataSource {
  readonly name: string; // registry key
  readonly sourceType: SourceType;
  search(query: string): Promise<SourceSearchResult[]>;
  // Returns null (not a thrown error) when nothing matches externalId —
  // "not found" is an expected, common outcome, not a failure.
  fetchRecord(externalId: string): Promise<GameSourceRecord | null>;
}
