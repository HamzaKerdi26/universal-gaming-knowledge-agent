import { promises as fs } from "fs";
import path from "path";
import { DocumentLoader } from "./documentLoader";
import { RawDocument } from "../types/document";
import { NotFoundError, ValidationError } from "../../utils/AppError";
import { logger } from "../../utils/logger";

const SUPPORTED_EXTENSIONS = new Set([".md", ".txt"]);
const DEFAULT_ALLOWED_ROOT = path.resolve(process.cwd(), "data/knowledge");

// Loads local .md/.txt files into RawDocuments.
//
// Convention: a file's immediate parent directory name is treated as the
// game slug (e.g. data/knowledge/elden-ring/combat.md -> gameSlug
// "elden-ring"), and the filename (without extension) becomes the
// category (e.g. "combat"). This works whether `source` points at one
// game's folder or a parent folder containing many games, as long as
// each document file lives directly inside its game's folder.
export class MarkdownLoader implements DocumentLoader {
  // Ingestion is restricted to this directory (and its subdirectories).
  // Without this, POST /api/rag/ingest would accept any filesystem path
  // in its request body and happily read + return the contents of
  // arbitrary files the Node process can see (e.g. "/etc/passwd", or a
  // traversal like "../../../etc/passwd") via the preview endpoint — an
  // arbitrary file read, and there's no authentication yet to even gate
  // who can trigger it. Defaults to data/knowledge; injectable so tests
  // can scope it to a fixtures directory instead.
  constructor(private readonly allowedRoot: string = DEFAULT_ALLOWED_ROOT) {}

  async load(source: string): Promise<RawDocument[]> {
    let canonicalRoot: string;
    try {
      canonicalRoot = await fs.realpath(this.allowedRoot);
    } catch {
      throw new NotFoundError("RAG knowledge directory not found");
    }

    const absoluteRoot = path.resolve(this.allowedRoot);
    const absoluteSource = path.resolve(source);
    this.assertWithinAllowedRoot(absoluteRoot, absoluteSource, source);

    let canonicalSource: string;
    try {
      canonicalSource = await fs.realpath(absoluteSource);
    } catch {
      throw new NotFoundError(`RAG source path not found: "${source}"`);
    }
    this.assertWithinAllowedRoot(canonicalRoot, canonicalSource, source);

    const stat = await fs.stat(canonicalSource);

    const filePaths = stat.isDirectory()
      ? await collectFiles(canonicalSource)
      : [canonicalSource];

    const documents: RawDocument[] = [];
    for (const filePath of filePaths) {
      const canonicalFile = await fs.realpath(filePath).catch(() => {
        throw new NotFoundError(`RAG source file not found: "${filePath}"`);
      });
      this.assertWithinAllowedRoot(canonicalRoot, canonicalFile, filePath);

      const doc = await loadFile(canonicalFile);
      if (doc) documents.push(doc);
    }

    return documents;
  }

  private assertWithinAllowedRoot(
    canonicalRoot: string,
    canonicalPath: string,
    originalSource: string
  ): void {
    const relative = path.relative(canonicalRoot, canonicalPath);
    const isWithinRoot =
      relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));

    if (!isWithinRoot) {
      throw new ValidationError(
        `RAG source path "${originalSource}" is outside the allowed knowledge directory`
      );
    }
  }
}

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue; // skip hidden files/dirs

    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
    } else if (SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      files.push(entryPath);
    }
  }

  return files.sort(); // deterministic order
}

async function loadFile(filePath: string): Promise<RawDocument | null> {
  const content = await fs.readFile(filePath, "utf-8");

  const gameSlug = path.basename(path.dirname(filePath));
  const category = path.basename(filePath, path.extname(filePath));
  const title = extractTitle(content) ?? humanize(category);
  const source = path.relative(process.cwd(), filePath);

  logger.info("Loaded RAG document", { source, gameSlug, category });

  return {
    id: `${gameSlug}-${category}`,
    title,
    content,
    source,
    sourceType: "file",
    gameSlug,
    metadata: { category },
  };
}

function extractTitle(content: string): string | null {
  const headingMatch = content.match(/^\s*#\s+(.+)$/m);
  return headingMatch ? headingMatch[1].trim() : null;
}

function humanize(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
