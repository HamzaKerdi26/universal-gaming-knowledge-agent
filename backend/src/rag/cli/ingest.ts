// Usage: npm run rag:ingest [-- <path>]
// Defaults to data/knowledge (the full sample dataset) when no path is given.
import { ingestionPipeline } from "../pipeline/ingestionPipeline";

async function main(): Promise<void> {
  const source = process.argv[2] ?? "data/knowledge";

  console.log("RAG ingestion started...\n");

  try {
    const result = await ingestionPipeline.ingest(source);

    console.log(`Documents processed: ${result.documents.length}`);
    console.log(`Chunks created: ${result.chunks.length}`);
    console.log("\nIngestion completed successfully.");
  } catch (err) {
    console.error("\nIngestion failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

main();
