import { WikipediaSource } from "../../../src/dataSources/providers/wikipediaSource";
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

describe("WikipediaSource", () => {
  let source: WikipediaSource;

  beforeEach(() => {
    global.fetch = jest.fn();
    source = new WikipediaSource();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("has the expected name and sourceType, and requires no API key to construct", () => {
    expect(source.name).toBe("wikipedia");
    expect(source.sourceType).toBe(SourceType.WIKI);
  });

  describe("search", () => {
    it("normalizes search results", async () => {
      mockFetchOnce(200, {
        query: { search: [{ title: "Elden Ring" }, { title: "Elden Ring: Shadow of the Erdtree" }] },
      });

      const results = await source.search("Elden Ring");

      expect(results).toEqual([
        { externalId: "Elden Ring", title: "Elden Ring", sourceUrl: "https://en.wikipedia.org/wiki/Elden_Ring" },
        {
          externalId: "Elden Ring: Shadow of the Erdtree",
          title: "Elden Ring: Shadow of the Erdtree",
          sourceUrl: "https://en.wikipedia.org/wiki/Elden_Ring%3A_Shadow_of_the_Erdtree",
        },
      ]);
    });

    it("returns an empty array when the response has no search results", async () => {
      mockFetchOnce(200, { query: {} });
      const results = await source.search("xyzxyz-nonexistent");
      expect(results).toEqual([]);
    });
  });

  describe("fetchRecord", () => {
    it("normalizes an article extract into a GameSourceRecord", async () => {
      mockFetchOnce(200, {
        query: {
          pages: {
            "12345": {
              pageid: 12345,
              title: "Elden Ring",
              extract: "Elden Ring is a 2022 action role-playing game developed by FromSoftware.",
              original: { source: "https://example.com/image.jpg" },
            },
          },
        },
      });

      const record = await source.fetchRecord("Elden Ring");

      expect(record).toMatchObject({
        title: "Elden Ring",
        slug: "elden-ring",
        content: "Elden Ring is a 2022 action role-playing game developed by FromSoftware.",
        description: "Elden Ring is a 2022 action role-playing game developed by FromSoftware.",
        externalId: "Elden Ring",
        source: "wikipedia",
        sourceType: SourceType.WIKI,
        sourceUrl: "https://en.wikipedia.org/wiki/Elden_Ring",
        imageUrl: "https://example.com/image.jpg",
      });
      expect(record?.retrievedAt).toEqual(expect.any(String));
      // Knowledge-source records don't carry structured game fields —
      // those aren't invented for a wiki article.
      expect(record?.developer).toBeUndefined();
      expect(record?.genres).toBeUndefined();
    });

    it("truncates very long article content defensively", async () => {
      const longText = "word ".repeat(10_000); // ~50,000 chars
      mockFetchOnce(200, {
        query: { pages: { "1": { pageid: 1, title: "Long Article", extract: longText } } },
      });

      const record = await source.fetchRecord("Long Article");

      expect(record?.content?.length).toBeLessThanOrEqual(20_000);
    });

    it("returns null for a missing/nonexistent page", async () => {
      mockFetchOnce(200, {
        query: { pages: { "-1": { pageid: -1, title: "Does Not Exist", missing: "" } } },
      });

      const record = await source.fetchRecord("Does Not Exist");
      expect(record).toBeNull();
    });

    it("returns null when the page has no extract at all", async () => {
      mockFetchOnce(200, {
        query: { pages: { "1": { pageid: 1, title: "Empty Page" } } },
      });

      const record = await source.fetchRecord("Empty Page");
      expect(record).toBeNull();
    });
  });

  describe("error handling", () => {
    it("wraps a network/timeout failure as a 503 DataSourceError", async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("network down"));
      await expect(source.search("test")).rejects.toMatchObject({ statusCode: 503 });
    });

    it("maps a 429 response to a rate-limit DataSourceError", async () => {
      mockFetchOnce(429, {}, false);
      await expect(source.search("test")).rejects.toMatchObject({ statusCode: 429 });
    });

    it("maps a non-2xx response to a 502 DataSourceError", async () => {
      mockFetchOnce(500, {}, false);
      await expect(source.search("test")).rejects.toBeInstanceOf(DataSourceError);
    });

    it("wraps a malformed (non-JSON) response as a 502 DataSourceError", async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("bad json");
        },
      });
      await expect(source.search("test")).rejects.toMatchObject({ statusCode: 502 });
    });
  });
});
