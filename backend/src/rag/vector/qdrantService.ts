import { QdrantClient } from "@qdrant/js-client-rest";
import { getQdrantClient } from "./qdrantClient";
import { QdrantError } from "./errors";
import { ChunkPayload, VectorPoint, VectorSearchMatch, VectorSearchOptions } from "./types";
import { env } from "../../config/env";
import { logger } from "../../utils/logger";

const DEFAULT_SEARCH_LIMIT = 5;

// Thin wrapper around the raw Qdrant REST client: collection management
// plus upsert/search/delete on the configured collection. Callers never
// touch @qdrant/js-client-rest directly — only this module does, so a
// different vector database could replace Qdrant later without changing
// vectorStore.ts or the search service.
export const qdrantService = {
  // Creates the configured collection if it doesn't already exist, using
  // the exact vector size reported by the active embedding provider —
  // never guessed or hardcoded — and cosine similarity, the standard
  // choice for normalized text embeddings like Gemini's.
  async ensureCollection(vectorSize: number): Promise<void> {
    const client = getQdrantClient();

    try {
      const exists = await collectionExists(client);
      if (exists) return;

      await client.createCollection(env.vector.qdrantCollection, {
        vectors: { size: vectorSize, distance: "Cosine" },
      });
      logger.info("Qdrant collection created", {
        collection: env.vector.qdrantCollection,
        vectorSize,
        distance: "Cosine",
      });
    } catch (err) {
      throw wrapQdrantError(err, "create the Qdrant collection");
    }
  },

  async upsertPoints(points: VectorPoint[]): Promise<void> {
    if (points.length === 0) return;

    const client = getQdrantClient();
    try {
      await client.upsert(env.vector.qdrantCollection, {
        wait: true,
        points: points.map((p) => ({
          id: p.id,
          vector: p.vector,
          payload: p.payload as unknown as Record<string, unknown>,
        })),
      });
      logger.info("Chunks upserted into Qdrant", {
        collection: env.vector.qdrantCollection,
        count: points.length,
      });
    } catch (err) {
      throw wrapQdrantError(err, "upsert points into Qdrant");
    }
  },

  async searchPoints(
    vector: number[],
    options: VectorSearchOptions = {}
  ): Promise<VectorSearchMatch[]> {
    const client = getQdrantClient();

    // Deliberately NOT catching collectionExists() failures here: a
    // genuinely unreachable Qdrant instance must surface as a 503
    // ("unavailable"), not be silently reinterpreted as a 404 ("nothing
    // ingested yet") — those are different problems with different fixes.
    // Only a successful check that returns false means "the collection
    // really doesn't exist."
    let exists: boolean;
    try {
      exists = await collectionExists(client);
    } catch (err) {
      throw wrapQdrantError(err, "search Qdrant");
    }
    if (!exists) {
      throw new QdrantError(
        "No knowledge has been ingested yet — run ingestion before searching.",
        404
      );
    }

    const must = [];
    if (options.gameSlug) must.push({ key: "gameSlug", match: { value: options.gameSlug } });
    if (options.category) must.push({ key: "category", match: { value: options.category } });

    try {
      const response = await client.query(env.vector.qdrantCollection, {
        query: vector,
        filter: must.length > 0 ? { must } : undefined,
        limit: options.limit ?? DEFAULT_SEARCH_LIMIT,
        with_payload: true,
      });

      logger.info("Vector search completed", {
        collection: env.vector.qdrantCollection,
        resultCount: response.points.length,
        gameSlug: options.gameSlug,
        category: options.category,
      });

      return response.points.map((point) => ({
        id: String(point.id),
        score: point.score,
        payload: point.payload as unknown as ChunkPayload,
      }));
    } catch (err) {
      throw wrapQdrantError(err, "search Qdrant");
    }
  },

  async deletePointsByDocumentId(documentId: string): Promise<void> {
    const client = getQdrantClient();

    // Same reasoning as searchPoints: don't let a real connectivity
    // failure masquerade as "nothing to delete" — a caller relying on
    // this to actually remove data needs to know Qdrant was unreachable,
    // not silently believe the delete succeeded (or was a no-op).
    let exists: boolean;
    try {
      exists = await collectionExists(client);
    } catch (err) {
      throw wrapQdrantError(err, "delete points from Qdrant");
    }
    if (!exists) return; // nothing to delete

    try {
      await client.delete(env.vector.qdrantCollection, {
        wait: true,
        filter: { must: [{ key: "documentId", match: { value: documentId } }] },
      });
      logger.info("Deleted document chunks from Qdrant", { documentId });
    } catch (err) {
      throw wrapQdrantError(err, "delete points from Qdrant");
    }
  },
};

async function collectionExists(client: QdrantClient): Promise<boolean> {
  const collections = await client.getCollections();
  return collections.collections.some((c) => c.name === env.vector.qdrantCollection);
}

// Wraps any Qdrant client error (connection refused, HTTP error, etc.)
// into a QdrantError with a safe, generic message — never forwards raw
// client/network error details (which could include the configured
// Qdrant URL or internal error bodies) to the API response.
function wrapQdrantError(err: unknown, action: string): QdrantError {
  logger.error(`Failed to ${action}`, {
    message: err instanceof Error ? err.message : String(err),
  });
  return new QdrantError(
    "The vector database is currently unavailable. Please try again shortly.",
    503
  );
}
