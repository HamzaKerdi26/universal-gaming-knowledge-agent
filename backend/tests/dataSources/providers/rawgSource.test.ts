import { RawgSource } from "../../../src/dataSources/providers/rawgSource";
import { DataSourceError } from "../../../src/dataSources/errors";
import { SourceType } from "../../../src/dataSources/types";

const originalFetch = global.fetch;

function mockFetchOnce(status: number, body: unknown, ok = status >= 200 && status < 300) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    status,
    json: async () => body,
  });
}

describe("RawgSource", () => {
  let source: RawgSource;

  beforeEach(() => {
    global.fetch = jest.fn();
    source = new RawgSource("fake-api-key");
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("has the expected name and sourceType", () => {
    expect(source.name).toBe("rawg");
    expect(source.sourceType).toBe(SourceType.API);
  });

  describe("search", () => {
    it("normalizes search results", async () => {
      mockFetchOnce(200, {
        results: [
          { id: 123, slug: "elden-ring", name: "Elden Ring", released: "2022-02-25", background_image: "img.jpg" },
        ],
      });

      const results = await source.search("elden ring");

      expect(results).toEqual([
        { externalId: "123", title: "Elden Ring", sourceUrl: "https://rawg.io/games/elden-ring" },
      ]);
    });

    it("returns an empty array for no results", async () => {
      mockFetchOnce(200, { results: [] });
      const results = await source.search("xyzxyz-nonexistent");
      expect(results).toEqual([]);
    });

    it("includes the api key in the request URL, never elsewhere", async () => {
      mockFetchOnce(200, { results: [] });
      await source.search("test");

      const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(calledUrl).toContain("key=fake-api-key");
    });
  });

  describe("fetchRecord", () => {
    it("normalizes a full game details response", async () => {
      mockFetchOnce(200, {
        id: 123,
        slug: "elden-ring",
        name: "Elden Ring",
        description_raw: "An open-world action RPG.",
        released: "2022-02-25",
        background_image: "img.jpg",
        developers: [{ name: "FromSoftware" }],
        publishers: [{ name: "Bandai Namco" }],
        genres: [{ name: "RPG" }, { name: "Action" }],
        platforms: [{ platform: { name: "PC" } }, { platform: { name: "PlayStation 5" } }],
      });

      const record = await source.fetchRecord("123");

      expect(record).toMatchObject({
        title: "Elden Ring",
        slug: "elden-ring",
        description: "An open-world action RPG.",
        developer: "FromSoftware",
        publisher: "Bandai Namco",
        releaseDate: "2022-02-25",
        genres: ["RPG", "Action"],
        platforms: ["PC", "PlayStation 5"],
        imageUrl: "img.jpg",
        externalId: "123",
        source: "rawg",
        sourceType: SourceType.API,
      });
      expect(record?.retrievedAt).toEqual(expect.any(String));
    });

    it("handles missing optional fields gracefully (does not invent data)", async () => {
      mockFetchOnce(200, {
        id: 1,
        slug: "some-game",
        name: "Some Game",
        released: null,
        background_image: null,
      });

      const record = await source.fetchRecord("1");

      expect(record?.developer).toBeUndefined();
      expect(record?.publisher).toBeUndefined();
      expect(record?.releaseDate).toBeUndefined();
      expect(record?.genres).toEqual([]);
      expect(record?.platforms).toEqual([]);
    });

    it("returns null (not an error) for a 404 game-not-found response", async () => {
      mockFetchOnce(404, { detail: "Not found." }, false);
      const record = await source.fetchRecord("does-not-exist");
      expect(record).toBeNull();
    });
  });

  describe("error handling", () => {
    it("wraps a network/timeout failure as a 503 DataSourceError", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("network down"));

      await expect(source.search("test")).rejects.toBeInstanceOf(DataSourceError);
      await expect(source.search("test")).rejects.toMatchObject({ statusCode: 503 });
    });

    it("maps a 429 response to a rate-limit DataSourceError", async () => {
      mockFetchOnce(429, { detail: "throttled" }, false);
      await expect(source.search("test")).rejects.toMatchObject({ statusCode: 429 });
    });

    it("maps a non-2xx/404/429 response to a 502 DataSourceError", async () => {
      mockFetchOnce(500, { detail: "server error" }, false);
      await expect(source.search("test")).rejects.toMatchObject({ statusCode: 502 });
    });

    it("wraps a malformed (non-JSON) response as a 502 DataSourceError", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("Unexpected token");
        },
      });

      await expect(source.search("test")).rejects.toMatchObject({ statusCode: 502 });
    });

    it("never leaks the raw underlying error message", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("secret internal detail"));

      await source.search("test").catch((err: DataSourceError) => {
        expect(err.message).not.toMatch(/secret internal detail/);
      });
    });
  });
});
