import { logger } from "../../utils/logger";
import { withAbortableTimeout } from "../../utils/withTimeout";
import { slugify } from "../../utils/slugify";
import { DataSource, GameSourceRecord, SourceSearchResult, SourceType } from "../types";
import { DataSourceError } from "../errors";

const REQUEST_TIMEOUT_MS = 10_000;
const BASE_URL = "https://en.wikipedia.org/w/api.php";
// Defensive cap on how much article text is pulled into one record —
// long-running franchise articles can be very large, and there's no
// need to embed an entire article verbatim to be useful as RAG context;
// the chunker (Phase 4) still splits whatever comes through here.
const MAX_CONTENT_LENGTH = 20_000;

interface WikiSearchResponse {
  query?: { search?: { title: string }[] };
}
interface WikiPage {
  pageid: number;
  title: string;
  missing?: string;
  extract?: string;
  original?: { source: string };
}
interface WikiExtractResponse {
  query?: { pages?: Record<string, WikiPage> };
}

// Wikipedia/Wikimedia's public REST-ish action API: the "knowledge/
// community source" half of Phase 8's "one structured API + one
// knowledge source" combination. Fully free and public — no API key, no
// registration, no OAuth — which is exactly why it was chosen over
// Reddit/Discord for this phase (those need real authentication setup
// the task explicitly says to defer). `origin=*` enables anonymous
// CORS-style access to the API from a server context; no credentials are
// involved.
export class WikipediaSource implements DataSource {
  public readonly name = "wikipedia";
  public readonly sourceType = SourceType.WIKI;

  async search(query: string): Promise<SourceSearchResult[]> {
    const url = `${BASE_URL}?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&format=json&origin=*`;

    const data = await this.fetchJson<WikiSearchResponse>(url, "search articles");
    const results = data.query?.search ?? [];

    return results.map((r) => ({
      externalId: r.title,
      title: r.title,
      sourceUrl: articleUrl(r.title),
    }));
  }

  async fetchRecord(externalId: string): Promise<GameSourceRecord | null> {
    // externalId is the article title itself (Wikipedia titles are
    // unique within a language wiki, and using it directly avoids a
    // second pageid-lookup round trip).
    const url = `${BASE_URL}?action=query&prop=extracts|pageimages&explaintext&piprop=original&redirects=1&titles=${encodeURIComponent(
      externalId
    )}&format=json&origin=*`;

    const data = await this.fetchJson<WikiExtractResponse>(url, "fetch article");
    const pages = data.query?.pages ?? {};
    const page = Object.values(pages)[0];

    if (!page || page.missing !== undefined || !page.extract) {
      return null;
    }

    const fullText = page.extract.trim();
    const content = fullText.slice(0, MAX_CONTENT_LENGTH);
    const description = fullText.split("\n").find((line) => line.trim().length > 0)?.slice(0, 500);

    return {
      title: page.title,
      slug: slugify(page.title),
      description,
      content,
      externalId: page.title,
      source: "wikipedia",
      sourceType: SourceType.WIKI,
      sourceUrl: articleUrl(page.title),
      imageUrl: page.original?.source,
      retrievedAt: new Date().toISOString(),
    };
  }

  private async fetchJson<T>(url: string, action: string): Promise<T> {
    let response: Response;
    try {
      response = await withAbortableTimeout((signal) => fetch(url, { signal }), REQUEST_TIMEOUT_MS);
    } catch (err) {
      logger.error(`Wikipedia source failed to ${action}`, {
        message: err instanceof Error ? err.message : String(err),
      });
      throw new DataSourceError(
        "The Wikipedia data source is currently unavailable. Please try again shortly.",
        503
      );
    }

    if (response.status === 429) {
      throw new DataSourceError(
        "The Wikipedia data source is rate-limiting requests. Please try again shortly.",
        429
      );
    }
    if (!response.ok) {
      logger.error(`Wikipedia source returned an error status while trying to ${action}`, {
        status: response.status,
      });
      throw new DataSourceError(
        "The Wikipedia data source returned an unexpected error.",
        502
      );
    }

    try {
      return (await response.json()) as T;
    } catch {
      logger.error(`Wikipedia source returned a malformed response while trying to ${action}`);
      throw new DataSourceError(
        "The Wikipedia data source returned a malformed response.",
        502
      );
    }
  }
}

function articleUrl(title: string): string {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
}
