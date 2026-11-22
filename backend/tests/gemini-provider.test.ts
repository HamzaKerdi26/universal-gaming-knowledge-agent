import { GeminiProvider } from "../src/services/ai/geminiProvider";
import { LLMProviderError } from "../src/services/ai/llmProvider";

const mockGenerateContent = jest.fn();

jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerateContent },
  })),
}));

describe("GeminiProvider", () => {
  beforeEach(() => {
    mockGenerateContent.mockReset();
  });

  it("sends system prompt and mapped history, returns the model's text", async () => {
    mockGenerateContent.mockResolvedValue({ text: "Elden Ring is an action RPG." });

    const provider = new GeminiProvider("fake-key", "gemini-2.5-flash");
    const result = await provider.generateReply({
      systemPrompt: "You are a gaming assistant.",
      history: [
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello! How can I help?" },
      ],
      message: "What is Elden Ring?",
    });

    expect(result).toEqual({
      content: "Elden Ring is an action RPG.",
      model: "gemini-2.5-flash",
    });

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const call = mockGenerateContent.mock.calls[0][0];
    expect(call.model).toBe("gemini-2.5-flash");
    expect(call.config.systemInstruction).toBe("You are a gaming assistant.");
    expect(call.contents).toEqual([
      { role: "user", parts: [{ text: "Hi" }] },
      { role: "model", parts: [{ text: "Hello! How can I help?" }] },
      { role: "user", parts: [{ text: "What is Elden Ring?" }] },
    ]);
  });

  it("throws a safe LLMProviderError when the SDK call rejects", async () => {
    mockGenerateContent.mockRejectedValue(new Error("upstream 500 from Gemini, key=SECRET123"));

    const provider = new GeminiProvider("fake-key", "gemini-2.5-flash");

    await expect(
      provider.generateReply({ systemPrompt: "x", history: [], message: "Hello" })
    ).rejects.toMatchObject({
      statusCode: 502,
    });

    // The raw SDK error (which could contain sensitive detail) must never
    // reach the thrown error's message.
    await provider
      .generateReply({ systemPrompt: "x", history: [], message: "Hello" })
      .catch((err: LLMProviderError) => {
        expect(err.message).not.toMatch(/SECRET123/);
      });
  });

  it("throws an LLMProviderError when the response has no text", async () => {
    mockGenerateContent.mockResolvedValue({ text: "" });

    const provider = new GeminiProvider("fake-key", "gemini-2.5-flash");

    await expect(
      provider.generateReply({ systemPrompt: "x", history: [], message: "Hello" })
    ).rejects.toBeInstanceOf(LLMProviderError);
  });
});
