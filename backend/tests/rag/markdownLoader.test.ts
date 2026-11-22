import fs from "fs";
import os from "os";
import path from "path";
import { MarkdownLoader } from "../../src/rag/loaders/markdownLoader";
import { NotFoundError, ValidationError } from "../../src/utils/AppError";

const FIXTURES_DIR = path.join(__dirname, "..", "fixtures", "rag-loader");

describe("MarkdownLoader", () => {
  // Scoped to the fixtures directory for these tests — production code
  // uses the default (data/knowledge) instead. See the dedicated
  // "allowed root" tests below for the containment behavior itself.
  const loader = new MarkdownLoader(FIXTURES_DIR);

  it("loads a valid markdown file", async () => {
    const docs = await loader.load(path.join(FIXTURES_DIR, "some-game", "doc.md"));

    expect(docs).toHaveLength(1);
    expect(docs[0].title).toBe("Some Game Overview");
    expect(docs[0].gameSlug).toBe("some-game");
    expect(docs[0].sourceType).toBe("file");
    expect(docs[0].content).toContain("second paragraph");
  });

  it("loads a valid text file", async () => {
    const docs = await loader.load(path.join(FIXTURES_DIR, "some-game", "note.txt"));

    expect(docs).toHaveLength(1);
    expect(docs[0].content).toContain("plain text fixture note");
    // No markdown heading in the .txt fixture, so the title is humanized
    // from the filename instead.
    expect(docs[0].title).toBe("Note");
  });

  it("loads all documents in a directory", async () => {
    const docs = await loader.load(path.join(FIXTURES_DIR, "some-game"));
    const ids = docs.map((d) => d.id).sort();

    expect(ids).toEqual(["some-game-doc", "some-game-note"]);
  });

  it("handles missing files by throwing a NotFoundError", async () => {
    await expect(
      loader.load(path.join(FIXTURES_DIR, "does-not-exist.md"))
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("handles empty files without throwing (returns empty content)", async () => {
    const docs = await loader.load(path.join(FIXTURES_DIR, "empty-doc", "empty.md"));

    expect(docs).toHaveLength(1);
    expect(docs[0].content).toBe("");
  });

  it("returns an empty array for a directory with no supported files", async () => {
    const docs = await loader.load(path.join(FIXTURES_DIR, "empty-dir"));
    expect(docs).toEqual([]);
  });

  it("allows loading the allowed root directory itself", async () => {
    const docs = await loader.load(FIXTURES_DIR);
    expect(docs.length).toBeGreaterThan(0);
  });

  it("rejects a source path outside the allowed root", async () => {
    const outsidePath = path.join(FIXTURES_DIR, "..", "..", "package.json");
    await expect(loader.load(outsidePath)).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a traversal attempt that resolves outside the allowed root", async () => {
    const traversal = path.join(FIXTURES_DIR, "some-game", "..", "..", "..", "package.json");
    await expect(loader.load(traversal)).rejects.toBeInstanceOf(ValidationError);
  });

  it("rejects a symlink inside the allowed root that points outside it", async () => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ugka-rag-symlink-"));
    const allowedRoot = path.join(temporaryRoot, "allowed");
    const outsideRoot = path.join(temporaryRoot, "outside");
    const linkPath = path.join(allowedRoot, "linked-game");
    fs.mkdirSync(allowedRoot);
    fs.mkdirSync(outsideRoot);
    fs.writeFileSync(path.join(outsideRoot, "private.md"), "# Private\nNot allowed");

    try {
      fs.symlinkSync(outsideRoot, linkPath, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "EPERM" || code === "EACCES" || code === "ENOTSUP") {
        console.warn(`Skipped symlink escape test: directory symlink unavailable (${code}).`);
        return;
      }
      throw error;
    }

    try {
      const symlinkLoader = new MarkdownLoader(allowedRoot);
      await expect(symlinkLoader.load(linkPath)).rejects.toBeInstanceOf(ValidationError);
    } finally {
      fs.rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
});
