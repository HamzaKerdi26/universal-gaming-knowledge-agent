const mockFindMany = jest.fn();

jest.mock("../src/config/prisma", () => ({
  prisma: { message: { findMany: (...args: unknown[]) => mockFindMany(...args) } },
}));

import { messageRepository } from "../src/repositories/message.repository";

describe("messageRepository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("limits LLM history to the 20 newest messages and returns them chronologically", async () => {
    mockFindMany.mockResolvedValue([
      { id: "m20", createdAt: new Date("2026-01-20") },
      { id: "m19", createdAt: new Date("2026-01-19") },
    ]);

    const messages = await messageRepository.findRecentByConversationId("conversation-1");

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { conversationId: "conversation-1" },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    expect(messages.map((message) => message.id)).toEqual(["m19", "m20"]);
  });
});