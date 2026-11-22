import dotenv from "dotenv";

dotenv.config();

function csvValues(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function integerSetting(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined) return fallback;
  const normalized = value.trim();
  return /^\d+$/.test(normalized) ? Number(normalized) : Number.NaN;
}

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: parseInt(process.env.PORT ?? "5000", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: required("DATABASE_URL"),
  isProduction: (process.env.NODE_ENV ?? "development") === "production",

  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresInSeconds: integerSetting("JWT_EXPIRES_IN_SECONDS", 3600),
    adminUserIds: csvValues(process.env.ADMIN_USER_IDS),
  },

  cors: {
    allowedOrigins: process.env.FRONTEND_ORIGINS === undefined
      ? (process.env.NODE_ENV === "production" ? [] : ["http://localhost:5173"])
      : csvValues(process.env.FRONTEND_ORIGINS),
  },

  rateLimit: {
    windowMs: integerSetting("RATE_LIMIT_WINDOW_MS", 60_000),
    authRegisterLimit: integerSetting("AUTH_REGISTER_LIMIT", 5),
    authLoginLimit: integerSetting("AUTH_LOGIN_LIMIT", 10),
    chatLimit: integerSetting("CHAT_LIMIT", 20),
    ragIngestLimit: integerSetting("RAG_INGEST_LIMIT", 20),
    sourceImportLimit: integerSetting("SOURCE_IMPORT_LIMIT", 20),
    ragSearchLimit: integerSetting("RAG_SEARCH_LIMIT", 30),
    sourceSearchLimit: integerSetting("SOURCE_SEARCH_LIMIT", 30),
  },

  ai: {
    // Which concrete LLMProvider implementation to use. Only "gemini" is
    // implemented in Phase 3; the abstraction exists so a different
    // provider can be added later without touching the service/controller.
    provider: process.env.AI_PROVIDER ?? "gemini",
    geminiApiKey: process.env.GEMINI_API_KEY,
    // gemini-2.5-flash is Google's current stable, cost-effective
    // general-purpose chat model — a good default for a conversational
    // assistant. Configurable so it can be swapped without a code change.
    geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
  },

  embedding: {
    // Which concrete EmbeddingProvider implementation to use (Phase 5).
    // Reuses GEMINI_API_KEY above — same Gemini account, separate model.
    provider: process.env.EMBEDDING_PROVIDER ?? "gemini",
    // gemini-embedding-001 is Google's current, actively supported text
    // embedding model — text-embedding-004 (the previous default) was
    // deprecated. This is a distinct model from the chat model above:
    // embedding and text generation are different responsibilities and
    // are never the same model.
    geminiModel: process.env.EMBEDDING_MODEL ?? "gemini-embedding-001",
    // gemini-embedding-001 natively outputs 3072 dimensions but supports
    // Matryoshka truncation to smaller sizes (768/1536/3072 are the
    // documented options) with minimal quality loss. 768 keeps Qdrant's
    // on-disk/in-memory footprint small, which fits a local dev instance
    // and this project's small sample dataset well; raise it via
    // EMBEDDING_DIMENSIONS if retrieval quality ever needs it.
    dimensions: parseInt(process.env.EMBEDDING_DIMENSIONS ?? "768", 10),
  },

  vector: {
    qdrantUrl: process.env.QDRANT_URL ?? "http://localhost:6333",
    qdrantCollection: process.env.QDRANT_COLLECTION ?? "gaming_knowledge",
  },

  dataSources: {
    // API key for the RAWG data source
    // (src/dataSources/providers/rawgSource.ts). The Wikipedia source
    // needs no credentials at all. Unlike ai.provider/embedding.provider
    // (which pick ONE active provider), Phase 8's data sources are a
    // registry of multiple simultaneously-available sources, so there's
    // no single "which one" switch here — just each source's own
    // config. Optional at this level: RawgSource itself reports a clear
    // 503 if used without a key configured, rather than crashing server
    // startup.
    rawgApiKey: process.env.RAWG_API_KEY,
  },
};
