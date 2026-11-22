import { QdrantClient } from "@qdrant/js-client-rest";
import { env } from "../../config/env";

let client: QdrantClient | null = null;

// Lazily constructs (and caches) the Qdrant REST client. Lazy for the
// same reason as getLLMProvider/getEmbeddingProvider: a missing/unreachable
// Qdrant instance shouldn't crash server startup, only surface as an
// error when a RAG ingest/search request actually needs it.
export function getQdrantClient(): QdrantClient {
  if (!client) {
    client = new QdrantClient({ url: env.vector.qdrantUrl });
  }
  return client;
}

// Exposed for tests so they can inject a fake/mock client instead of
// requiring a real Qdrant server.
export function setQdrantClientForTesting(fakeClient: QdrantClient | null): void {
  client = fakeClient;
}
