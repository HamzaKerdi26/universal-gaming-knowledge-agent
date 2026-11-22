import { RawDocument } from "../types/document";

// Any way of getting documents into the pipeline implements this — a
// local file/directory loader today, potentially a web-scrape or
// database loader later. The pipeline only ever depends on this
// interface, never on a specific loading mechanism.
export interface DocumentLoader {
  load(source: string): Promise<RawDocument[]>;
}
