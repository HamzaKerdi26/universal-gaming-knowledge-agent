// Unit tests for the provider factory itself, isolated from the HTTP
// layer. These mock the env module directly so the result doesn't depend
// on whether a real GEMINI_API_KEY happens to be set wherever tests run.

describe("AI provider factory", () => {
  afterEach(() => {
    jest.resetModules();
  });

  it("throws a 503 LLMProviderError when GEMINI_API_KEY is missing", async () => {
    jest.doMock("../src/config/env", () => ({
      env: { ai: { provider: "gemini", geminiApiKey: undefined, geminiModel: "gemini-2.5-flash" } },
    }));

    const { getLLMProvider } = await import("../src/services/ai");
    const { LLMProviderError } = await import("../src/services/ai/llmProvider");

    try {
      getLLMProvider();
      throw new Error("expected getLLMProvider to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(LLMProviderError);
      expect((err as InstanceType<typeof LLMProviderError>).statusCode).toBe(503);
    }
  });

  it("throws a 500 error for an unsupported AI_PROVIDER value", async () => {
    jest.doMock("../src/config/env", () => ({
      env: { ai: { provider: "not-a-real-provider", geminiApiKey: "key", geminiModel: "x" } },
    }));

    const { getLLMProvider } = await import("../src/services/ai");
    const { LLMProviderError } = await import("../src/services/ai/llmProvider");

    try {
      getLLMProvider();
      throw new Error("expected getLLMProvider to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(LLMProviderError);
      expect((err as InstanceType<typeof LLMProviderError>).statusCode).toBe(500);
    }
  });

  it("constructs a GeminiProvider when an API key is configured", async () => {
    jest.doMock("../src/config/env", () => ({
      env: { ai: { provider: "gemini", geminiApiKey: "fake-key-for-construction-only", geminiModel: "gemini-2.5-flash" } },
    }));

    const { getLLMProvider } = await import("../src/services/ai");
    const provider = getLLMProvider();
    expect(provider.name).toBe("gemini");
  });
});
