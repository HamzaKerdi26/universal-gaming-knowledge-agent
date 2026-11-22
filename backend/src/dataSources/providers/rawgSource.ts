import { logger } from "../../utils/logger";
import { withAbortableTimeout } from "../../utils/withTimeout";
import { DataSource, GameSourceRecord, SourceSearchResult, SourceType } from "../types";
import { DataSourceError } from "../errors";

const REQUEST_TIMEOUT_MS = 10_000;
const BASE_URL = "https://api.rawg.io/api";

interface RawgSearchResult {
  id: number;
  slug: string;
  name: string;
  released: string | null;
  background_image: string | null;
}
interface RawgSearchResponse {
  results: RawgSearchResult[];
}
interface RawgGameDetails {
  id: number;
  slug: string;
  name: string;
  description_raw?: string;
  released: string | null;
  background_image: string | null;
  developers?: { name: string }[];
  publishers?: { name: string }[];
  genres?: { name: string }[];
  platforms?: { platform: { name: string } }[];
}

// RAWG (rawg.io): a genuinely free-tier, well-documented public game
// database API — exactly the "structured game-data API" half of Phase
// 8's "one structured API + one knowledge source" combination. Requires
// a free API key (read from RAWG_API_KEY, never hardcoded); no paid tier
// is used or required.
export class RawgSource implements DataSource {
  public readonly name = "rawg";
  public readonly sourceType = SourceType.API;

  constructor(private readonly apiKey: string) {}

  async search(query: string): Promise<SourceSearchResult[]> {
    const url = `${BASE_URL}/games?key=${encodeURIComponent(this.apiKey)}&search=${encodeURIComponent(query)}&page_size=10`;
    const data = await this.fetchJson<RawgSearchResponse>(url, "search games");

    return data.results.map((g) => ({
      externalId: String(g.id),
      title: g.name,
      sourceUrl: `https://rawg.io/games/${g.slug}`,
    }));
  }

  async fetchRecord(externalId: string): Promise<GameSourceRecord | null> {
    const url = `${BASE_URL}/games/${encodeURIComponent(externalId)}?key=${encodeURIComponent(this.apiKey)}`;

    let data: RawgGameDetails;
    try {
      data = await this.fetchJson<RawgGameDetails>(url, "get game details");
    } catch (err) {
      if (err instanceof DataSourceError && err.statusCode === 404) return null;
      throw err;
    }

    return {
      title: data.name,
      slug: data.slug,
      description: data.description_raw?.trim() || undefined,
      developer: data.developers?.[0]?.name,
      publisher: data.publishers?.[0]?.name,
      releaseDate: data.released ?? undefined,
      genres: data.genres?.map((g) => g.name) ?? [],
      platforms: data.platforms?.map((p) => p.platform.name) ?? [],
      imageUrl: data.background_image ?? undefined,
      externalId: String(data.id),
      source: "rawg",
      sourceType: SourceType.API,
      sourceUrl: `https://rawg.io/games/${data.slug}`,
      retrievedAt: new Date().toISOString(),
    };
  }

  private async fetchJson<T>(url: string, action: string): Promise<T> {
    let response: Response;
    try {
      response = await withAbortableTimeout((signal) => fetch(url, { signal }), REQUEST_TIMEOUT_MS);
    } catch (err) {
      logger.error(`RAWG source failed to ${action}`, {
        message: err instanceof Error ? err.message : String(err),
      });
      throw new DataSourceError(
        "The RAWG data source is currently unavailable. Please try again shortly.",
        503
      );
    }

    if (response.status === 404) {
      throw new DataSourceError("Game not found.", 404);
    }
    if (response.status === 429) {
      throw new DataSourceError(
        "The RAWG data source is rate-limiting requests. Please try again shortly.",
        429
      );
    }
    if (!response.ok) {
      logger.error(`RAWG source returned an error status while trying to ${action}`, {
        status: response.status,
      });
      throw new DataSourceError("The RAWG data source returned an unexpected error.", 502);
    }

    try {
      return (await response.json()) as T;
    } catch {
      logger.error(`RAWG source returned a malformed response while trying to ${action}`);
      throw new DataSourceError("The RAWG data source returned a malformed response.", 502);
    }
  }
}
