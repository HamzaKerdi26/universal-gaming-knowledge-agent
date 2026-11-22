// Normalizes raw document text before chunking. Deliberately conservative:
// RAG quality depends on preserving useful context, so this only removes
// formatting *noise* (inconsistent line endings, trailing whitespace,
// excessive blank lines) — it never touches wording, headings, or
// paragraph content.
export function normalizeText(content: string): string {
  const unifiedLineEndings = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const trimmedLines = unifiedLineEndings
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, "")); // trailing whitespace per line

  const collapsedBlankLines = collapseExcessiveBlankLines(trimmedLines);

  return collapsedBlankLines.join("\n").trim();
}

// Collapses runs of 2+ consecutive blank lines down to exactly one blank
// line, preserving single blank lines (paragraph breaks) as-is.
function collapseExcessiveBlankLines(lines: string[]): string[] {
  const result: string[] = [];
  let blankRun = 0;

  for (const line of lines) {
    if (line.trim() === "") {
      blankRun += 1;
      if (blankRun <= 1) result.push(line);
    } else {
      blankRun = 0;
      result.push(line);
    }
  }

  return result;
}
