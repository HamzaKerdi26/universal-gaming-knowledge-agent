import { GeminiEmbeddingProvider } from "../../../src/services/ai/geminiEmbeddingProvider";
import { EmbeddingProviderError } from "../../../src/services/ai/embeddingProvider";

const mockEmbedContent = jest.fn();

jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { embedContent: mockEmbedContent },
  })),
}));

function makeVector(length: number, seed: number): number[] {
  return Array.from({ length }, (_, i) => (i + seed) / 1000);
}

describe("GeminiEmbeddingProvider", () => {
  beforeEach(() => {
    mockEmbedContent.mockReset();
  });

  it("returns a vector of the configured length for a single text", async () => {
    const vector = makeVector(768, 1);
    mockEmbedContent.mockResolvedValue({ embeddings: [{ values: vector }] });

    const provider = new GeminiEmbeddingProvider("fake-key", "gemini-embedding-001", 768);
    const result = await provider.embedText("What is Elden Ring?", "RETRIEVAL_QUERY");

    expect(result).toEqual(vector);
    expect(result).toHaveLength(768);

    expect(mockEmbedContent).toHaveBeenCalledTimes(1);
    const call = mockEmbedContent.mock.calls[0][0];
    expect(call.model).toBe("gemini-embedding-001");
    expect(call.contents).toEqual(["What is Elden Ring?"]);
    expect(call.config.taskType).toBe("RETRIEVAL_QUERY");
    expect(call.config.outputDimensionality).toBe(768);
  });

  it("embeds multiple texts in one call and returns vectors in the same order", async () => {
    const vectors = [makeVector(768, 1), makeVector(768, 2), makeVector(768, 3)];
    mockEmbedContent.mockResolvedValue({
      embeddings: vectors.map((values) => ({ values })),
    });

    const provider = new GeminiEmbeddingProvider("fake-key", "gemini-embedding-001", 768);
    const result = await provider.embedTexts(
      ["doc one", "doc two", "doc three"],
      "RETRIEVAL_DOCUMENT"
    );

    expect(result).toEqual(vectors);
    expect(mockEmbedContent).toHaveBeenCalledTimes(1);
    expect(mockEmbedContent.mock.calls[0][0].contents).toEqual([
      "doc one",
      "doc two",
      "doc three",
    ]);
  });

  it("batches large inputs across multiple embedContent calls", async () => {
    mockEmbedContent.mockImplementation(async ({ contents }: { contents: string[] }) => ({
      embeddings: contents.map((_, i) => ({ values: makeVector(768, i) })),
    }));

    const provider = new GeminiEmbeddingProvider("fake-key", "gemini-embedding-001", 768);
    const texts = Array.from({ length: 45 }, (_, i) => `chunk ${i}`);
    const result = await provider.embedTexts(texts, "RETRIEVAL_DOCUMENT");

    expect(result).toHaveLength(45);
    // 45 items at a batch size of 20 -> 3 calls (20 + 20 + 5).
    expect(mockEmbedContent).toHaveBeenCalledTimes(3);
  });

  it("returns an empty array for an empty input without calling the SDK", async () => {
    const provider = new GeminiEmbeddingProvider("fake-key", "gemini-embedding-001", 768);
    const result = await provider.embedTexts([]);

    expect(result).toEqual([]);
    expect(mockEmbedContent).not.toHaveBeenCalled();
  });

  it("throws a safe EmbeddingProviderError when the SDK call rejects", async () => {
    mockEmbedContent.mockRejectedValue(new Error("upstream 500, key=SECRET123"));

    const provider = new GeminiEmbeddingProvider("fake-key", "gemini-embedding-001", 768);

    await expect(provider.embedText("hello")).rejects.toMatchObject({ statusCode: 502 });

    await provider.embedText("hello").catch((err: EmbeddingProviderError) => {
      expect(err.message).not.toMatch(/SECRET123/);
    });
  });

  it("validates the returned vector dimensions match the configured size", async () => {
    mockEmbedContent.mockResolvedValue({
      embeddings: [{ values: makeVector(512, 1) }], // wrong size, expected 768
    });

    const provider = new GeminiEmbeddingProvider("fake-key", "gemini-embedding-001", 768);

    await expect(provider.embedText("hello")).rejects.toBeInstanceOf(EmbeddingProviderError);
    await expect(provider.embedText("hello")).rejects.toMatchObject({
      message: expect.stringContaining("dimension mismatch"),
    });
  });

  it("throws when the SDK returns an empty vector", async () => {
    mockEmbedContent.mockResolvedValue({ embeddings: [{ values: [] }] });

    const provider = new GeminiEmbeddingProvider("fake-key", "gemini-embedding-001", 768);

    await expect(provider.embedText("hello")).rejects.toBeInstanceOf(EmbeddingProviderError);
  });

  it("throws when the SDK returns a mismatched number of embeddings", async () => {
    mockEmbedContent.mockResolvedValue({ embeddings: [{ values: makeVector(768, 1) }] }); // only 1, but 2 texts requested

    const provider = new GeminiEmbeddingProvider("fake-key", "gemini-embedding-001", 768);

    await expect(provider.embedTexts(["a", "b"])).rejects.toBeInstanceOf(
      EmbeddingProviderError
    );
  });
});
