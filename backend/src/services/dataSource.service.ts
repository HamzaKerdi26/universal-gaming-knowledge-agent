import { Game } from "@prisma/client";
import "../dataSources"; // side-effect: registers all built-in data sources
import { dataSourceRegistry } from "../dataSources/registry";
import { GameSourceRecord, SourceSearchResult, SourceType } from "../dataSources/types";
import { gameRepository } from "../repositories/game.repository";
import { vectorStore } from "../rag/store/vectorStore";
import { normalizeText } from "../rag/processors/normalizer";
import { extractMetadata } from "../rag/processors/metadataExtractor";
import { chunkDocument } from "../rag/chunkers/chunker";
import { validateRawDocument, validateChunk } from "../rag/pipeline/validation";
import { ProcessedDocument, RawDocument } from "../rag/types/document";
import { DataSourceError } from "../dataSources/errors";
import { NotFoundError } from "../utils/AppError";
import { logger } from "../utils/logger";

export interface ImportResult {
  record: GameSourceRecord;
  game?: { game: Game; created: boolean };
  ragIngested: boolean;
}

// Orchestrates Phase 8's data sources: search/import, persisting
// structured game records into the existing Game table, and feeding
// every imported record into the existing Phase 4/5 RAG pipeline. This
// file is the only place a data source and the rest of the app meet —
// it never talks to a specific source's HTTP API directly, and it never
// re-implements chunking/embedding/Qdrant logic that already exists.
export const dataSourceService = {
  listSources() {
    return dataSourceRegistry.list();
  },

  async search(sourceName: string, query: string): Promise<SourceSearchResult[]> {
    const source = getSourceOrThrow(sourceName);
    try {
      return await source.search(query);
    } catch (err) {
      if (err instanceof DataSourceError) throw err;
      throw new DataSourceError("The data source returned an unexpected error.", 500);
    }
  },

  async importRecord(sourceName: string, externalId: string): Promise<ImportResult> {
    const source = getSourceOrThrow(sourceName);
    let record: GameSourceRecord | null;
    try {
      record = await source.fetchRecord(externalId);
    } catch (err) {
      if (err instanceof DataSourceError) throw err;
      throw new DataSourceError("The data source returned an unexpected error.", 500);
    }
    if (!record) {
      throw new NotFoundError(
        `No record found for external id "${externalId}" from source "${sourceName}".`
      );
    }

    // Structured game-data (API) sources map onto our Game table;
    // knowledge/community sources (wiki, and later Reddit/Discord/web)
    // don't carry the structured fields a Game row needs, so they only
    // ever become RAG knowledge, never a Games row.
    const game =
      record.sourceType === SourceType.API ? await persistGameRecord(record) : undefined;

    let ragIngested = false;
    try {
      await ingestRecordIntoRag(record);
      ragIngested = true;
    } catch (err) {
      // A RAG/Qdrant outage shouldn't block the (already-completed)
      // database import — same "log loud, degrade gracefully" choice
      // already used for chat's RAG retrieval (Phase 5.5) and RAG
      // ingestion generally. The caller can see ragIngested: false and
      // retry ingestion later; the record itself isn't lost.
      logger.error("Failed to ingest external record into RAG/Qdrant", {
        source: sourceName,
        externalId,
        message: err instanceof Error ? err.message : String(err),
      });
    }

    return { record, game, ragIngested };
  },
};

function getSourceOrThrow(name: string) {
  const source = dataSourceRegistry.get(name);
  if (!source) {
    throw new NotFoundError(`Unknown data source: "${name}"`);
  }
  return source;
}

async function persistGameRecord(record: GameSourceRecord): Promise<{ game: Game; created: boolean }> {
  const existing = await gameRepository.findBySlug(record.slug);

  const fields = {
    title: record.title,
    description: record.description,
    developer: record.developer,
    publisher: record.publisher,
    releaseDate: record.releaseDate ? new Date(record.releaseDate) : undefined,
  };

  if (existing) {
    // Re-importing/refreshing an already-known game updates it rather
    // than conflicting. This is deliberately different from the manual
    // POST /api/games endpoint (gameService.createGame), which correctly
    // treats a duplicate slug as a conflict when a human is manually
    // creating a record — a sync from an external source is expected to
    // be repeatable/idempotent instead, not an error.
    const updated = await gameRepository.update(existing.id, fields);
    return { game: updated, created: false };
  }

  const created = await gameRepository.create({ ...fields, slug: record.slug });
  return { game: created, created: true };
}

async function ingestRecordIntoRag(record: GameSourceRecord): Promise<void> {
  const raw = buildRawDocument(record);
  validateRawDocument(raw);

  const content = normalizeText(raw.content);
  const metadata = extractMetadata(raw);
  const processed: ProcessedDocument = {
    id: raw.id,
    title: raw.title,
    content,
    source: raw.source,
    sourceType: raw.sourceType,
    gameSlug: raw.gameSlug,
    metadata,
  };

  const chunks = chunkDocument(processed);
  chunks.forEach(validateChunk);

  await vectorStore.upsertChunks(chunks);
}

// Builds a Phase 4-shaped RawDocument from a GameSourceRecord so the
// existing normalize -> extract metadata -> chunk -> validate pipeline
// (unchanged since Phase 4) can be reused verbatim. Source metadata
// (provider, the richer SourceType, sourceUrl, retrievedAt) is preserved
// in the document's metadata bag so a chunk retrieved later can still
// identify where it came from.
function buildRawDocument(record: GameSourceRecord): RawDocument {
  const bodyLines: string[] = [`# ${record.title}`, ""];

  if (record.content) {
    bodyLines.push(record.content, "");
  } else if (record.description) {
    bodyLines.push(record.description, "");
  }

  if (record.developer) bodyLines.push(`Developer: ${record.developer}`);
  if (record.publisher) bodyLines.push(`Publisher: ${record.publisher}`);
  if (record.releaseDate) bodyLines.push(`Release date: ${record.releaseDate}`);
  if (record.genres && record.genres.length > 0) {
    bodyLines.push(`Genres: ${record.genres.join(", ")}`);
  }
  if (record.platforms && record.platforms.length > 0) {
    bodyLines.push(`Platforms: ${record.platforms.join(", ")}`);
  }

  return {
    // Phase 4's RawDocument.sourceType is the narrower loader-facing
    // union (file|web|manual) — every external data source maps to
    // "web" there, while the richer SourceType (API/WIKI/REDDIT/...) is
    // preserved separately in metadata below rather than lost.
    id: `${record.slug}-${record.source}`,
    title: record.title,
    content: bodyLines.join("\n"),
    source: record.sourceUrl ?? `external:${record.source}:${record.externalId}`,
    sourceType: "web",
    gameSlug: record.slug,
    metadata: {
      category: record.sourceType === SourceType.API ? "external-overview" : "external-knowledge",
      provider: record.source,
      sourceType: record.sourceType,
      sourceUrl: record.sourceUrl,
      retrievedAt: record.retrievedAt,
    },
  };
}
