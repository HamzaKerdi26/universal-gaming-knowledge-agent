// Unit tests for the embedding provider factory, isolated from the HTTP
// layer. Mocks the env module directly so results don't depend on
// whether a real GEMINI_API_KEY happens to be set wherever tests run.

describe("Embedding provider factory", () => {
  afterEach(() => {
    jest.resetModules();
  });

  it("throws a 503 EmbeddingProviderError when GEMINI_API_KEY is missing", async () => {
    jest.doMock("../src/config/env", () => ({
      env: {
        ai: { geminiApiKey: undefined },
        embedding: { provider: "gemini", geminiModel: "gemini-embedding-001", dimensions: 768 },
      },
    }));

    const { getEmbeddingProvider } = await import("../src/services/ai");
    const { EmbeddingProviderError } = await import("../src/services/ai/embeddingProvider");

    try {
      getEmbeddingProvider();
      throw new Error("expected getEmbeddingProvider to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(EmbeddingProviderError);
      expect((err as InstanceType<typeof EmbeddingProviderError>).statusCode).toBe(503);
    }
  });

  it("throws a 500 error for an unsupported EMBEDDING_PROVIDER value", async () => {
    jest.doMock("../src/config/env", () => ({
      env: {
        ai: { geminiApiKey: "key" },
        embedding: { provider: "not-a-real-provider", geminiModel: "x", dimensions: 768 },
      },
    }));

    const { getEmbeddingProvider } = await import("../src/services/ai");
    const { EmbeddingProviderError } = await import("../src/services/ai/embeddingProvider");

    try {
      getEmbeddingProvider();
      throw new Error("expected getEmbeddingProvider to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(EmbeddingProviderError);
      expect((err as InstanceType<typeof EmbeddingProviderError>).statusCode).toBe(500);
    }
  });

  it("constructs a GeminiEmbeddingProvider with the configured model/dimensions when an API key is present", async () => {
    jest.doMock("../src/config/env", () => ({
      env: {
        ai: { geminiApiKey: "fake-key-for-construction-only" },
        embedding: { provider: "gemini", geminiModel: "gemini-embedding-001", dimensions: 768 },
      },
    }));

    const { getEmbeddingProvider } = await import("../src/services/ai");
    const provider = getEmbeddingProvider();

    expect(provider.name).toBe("gemini");
    expect(provider.model).toBe("gemini-embedding-001");
    expect(provider.dimensions).toBe(768);
  });
});
