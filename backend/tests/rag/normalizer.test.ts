import { normalizeText } from "../../src/rag/processors/normalizer";

describe("normalizeText", () => {
  it("collapses excessive blank lines to a single blank line", () => {
    const input = "Paragraph one.\n\n\n\n\nParagraph two.";
    const result = normalizeText(input);

    expect(result).toBe("Paragraph one.\n\nParagraph two.");
  });

  it("preserves a single blank line between paragraphs", () => {
    const input = "Paragraph one.\n\nParagraph two.";
    expect(normalizeText(input)).toBe(input);
  });

  it("normalizes CRLF and CR line endings to LF", () => {
    const input = "Line one.\r\nLine two.\rLine three.";
    const result = normalizeText(input);

    expect(result).toBe("Line one.\nLine two.\nLine three.");
  });

  it("trims trailing whitespace from each line without touching content", () => {
    const input = "Line one.   \nLine two.\t\t\nLine three.";
    const result = normalizeText(input);

    expect(result).toBe("Line one.\nLine two.\nLine three.");
  });

  it("trims leading/trailing blank lines from the whole document", () => {
    const input = "\n\n\nActual content.\n\n\n";
    expect(normalizeText(input)).toBe("Actual content.");
  });

  it("preserves markdown headings", () => {
    const input = "# A Heading\n\nSome body text.";
    expect(normalizeText(input)).toBe(input);
  });

  it("preserves meaningful content and does not strip words", () => {
    const input =
      "# Title\n\nFirst paragraph with meaningful detail about the topic.\n\nSecond paragraph with more detail.";
    const result = normalizeText(input);

    expect(result).toContain("First paragraph with meaningful detail");
    expect(result).toContain("Second paragraph with more detail");
    expect(result).toContain("# Title");
  });
});
