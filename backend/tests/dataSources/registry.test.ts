import { dataSourceRegistry } from "../../src/dataSources/registry";
import { DataSource, SourceType } from "../../src/dataSources/types";

function makeFakeSource(overrides: Partial<DataSource> = {}): DataSource {
  return {
    name: "fake-source",
    sourceType: SourceType.API,
    search: jest.fn().mockResolvedValue([]),
    fetchRecord: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe("dataSourceRegistry", () => {
  afterEach(() => {
    dataSourceRegistry.clear();
  });

  it("registers a source and makes it discoverable via list()", () => {
    dataSourceRegistry.register(makeFakeSource());

    expect(dataSourceRegistry.list()).toEqual([
      { name: "fake-source", sourceType: SourceType.API },
    ]);
  });

  it("looks up a registered source by name", () => {
    const source = makeFakeSource();
    dataSourceRegistry.register(source);

    expect(dataSourceRegistry.get("fake-source")).toBe(source);
  });

  it("returns undefined for a source that was never registered", () => {
    expect(dataSourceRegistry.get("does-not-exist")).toBeUndefined();
  });

  it("throws when registering two sources under the same name", () => {
    dataSourceRegistry.register(makeFakeSource());
    expect(() => dataSourceRegistry.register(makeFakeSource())).toThrow(/already registered/i);
  });

  it("list() reflects multiple registered sources with their source types", () => {
    dataSourceRegistry.register(makeFakeSource({ name: "rawg", sourceType: SourceType.API }));
    dataSourceRegistry.register(makeFakeSource({ name: "wikipedia", sourceType: SourceType.WIKI }));

    expect(dataSourceRegistry.list().sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: "rawg", sourceType: SourceType.API },
      { name: "wikipedia", sourceType: SourceType.WIKI },
    ]);
  });
});
