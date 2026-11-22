const mockFindBySlug = jest.fn();
const mockFindByTitle = jest.fn();

jest.mock("../../../src/repositories/game.repository", () => ({
  gameRepository: {
    findBySlug: (...args: unknown[]) => mockFindBySlug(...args),
    findByTitle: (...args: unknown[]) => mockFindByTitle(...args),
  },
}));

import { getGameInfoTool } from "../../../src/mcp/tools/getGameInfo.tool";

const sampleGame = {
  id: "game-1",
  title: "Elden Ring",
  slug: "elden-ring",
  description: "An open-world action RPG.",
  releaseDate: new Date("2022-02-25T00:00:00.000Z"),
  developer: "FromSoftware",
  publisher: "Bandai Namco Entertainment",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("getGameInfoTool", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("has the expected name/description and a Zod input schema", () => {
    expect(getGameInfoTool.name).toBe("get_game_info");
    expect(getGameInfoTool.description).toEqual(expect.any(String));
    expect(typeof getGameInfoTool.inputSchema.safeParse).toBe("function");
  });

  it("rejects input with neither slug nor title", () => {
    const result = getGameInfoTool.inputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts input with only a slug", () => {
    const result = getGameInfoTool.inputSchema.safeParse({ slug: "elden-ring" });
    expect(result.success).toBe(true);
  });

  it("accepts input with only a title", () => {
    const result = getGameInfoTool.inputSchema.safeParse({ title: "Elden Ring" });
    expect(result.success).toBe(true);
  });

  it("looks up by slug via gameRepository.findBySlug when a slug is given", async () => {
    mockFindBySlug.mockResolvedValue(sampleGame);

    const result = await getGameInfoTool.execute({ slug: "elden-ring" });

    expect(mockFindBySlug).toHaveBeenCalledWith("elden-ring");
    expect(mockFindByTitle).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it("looks up by title via gameRepository.findByTitle when only a title is given", async () => {
    mockFindByTitle.mockResolvedValue(sampleGame);

    const result = await getGameInfoTool.execute({ title: "Elden Ring" });

    expect(mockFindByTitle).toHaveBeenCalledWith("Elden Ring");
    expect(mockFindBySlug).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it("returns structured data matching the found game, without inventing fields", async () => {
    mockFindByTitle.mockResolvedValue(sampleGame);

    const result = await getGameInfoTool.execute({ title: "Elden Ring" });

    expect(result.data).toEqual({
      id: "game-1",
      title: "Elden Ring",
      slug: "elden-ring",
      description: "An open-world action RPG.",
      releaseDate: sampleGame.releaseDate,
      developer: "FromSoftware",
      publisher: "Bandai Namco Entertainment",
    });
  });

  it("handles game-not-found cleanly (no throw, structured failure)", async () => {
    mockFindByTitle.mockResolvedValue(null);

    const result = await getGameInfoTool.execute({ title: "Some Unknown Game" });

    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toContain("Some Unknown Game");
  });
});
