const mockUserCreate = jest.fn();
const mockUserFindById = jest.fn();
const mockUserFindByEmail = jest.fn();
const mockUserFindByUsername = jest.fn();
const mockUserFindByEmailForAuthentication = jest.fn();
const mockChatSendMessage = jest.fn();

jest.mock("../src/repositories/user.repository", () => ({
  userRepository: {
    create: (...args: unknown[]) => mockUserCreate(...args),
    findById: (...args: unknown[]) => mockUserFindById(...args),
    findByEmail: (...args: unknown[]) => mockUserFindByEmail(...args),
    findByUsername: (...args: unknown[]) => mockUserFindByUsername(...args),
    findByEmailForAuthentication: (...args: unknown[]) =>
      mockUserFindByEmailForAuthentication(...args),
  },
}));

jest.mock("../src/services/chat.service", () => ({
  chatService: { sendMessage: (...args: unknown[]) => mockChatSendMessage(...args) },
}));

import request from "supertest";
import jwt from "jsonwebtoken";
import { createApp } from "../src/app";
import { createAccessToken, verifyAccessToken } from "../src/utils/jwt";
import { hashPassword, verifyPassword } from "../src/utils/password";

const TEST_SECRET = "phase9-auth-test-secret-with-more-than-32-chars";
const app = createApp();
const safeUser = () => ({
  id: "8ce88d55-2af9-4a6b-a7eb-87332c301e2a",
  username: "player-one",
  email: "player@example.test",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.JWT_SECRET = TEST_SECRET;
  mockUserCreate.mockResolvedValue(safeUser());
  mockUserFindById.mockResolvedValue(safeUser());
  mockUserFindByEmail.mockResolvedValue(null);
  mockUserFindByUsername.mockResolvedValue(null);
  mockUserFindByEmailForAuthentication.mockResolvedValue(null);
  mockChatSendMessage.mockResolvedValue({
    message: "A reply",
    model: "test-model",
    provider: "test-provider",
    conversationId: "conversation-1",
  });
});

describe("Authentication API", () => {
  it("registers a user with a salted password hash and never returns it", async () => {
    const response = await request(app).post("/api/auth/register").send({
      email: "Player@Example.test",
      username: "player-one",
      password: "correct horse battery",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user).toEqual(expect.objectContaining({
      id: safeUser().id,
      email: "player@example.test",
      username: "player-one",
    }));
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.token).toEqual(expect.any(String));

    const createInput = mockUserCreate.mock.calls[0][0] as { passwordHash: string };
    expect(createInput.passwordHash).not.toBe("correct horse battery");
    expect(await verifyPassword("correct horse battery", createInput.passwordHash)).toBe(true);
    expect(await verifyPassword("wrong password", createInput.passwordHash)).toBe(false);
    expect(verifyAccessToken(response.body.data.token)).toEqual({ userId: safeUser().id });
  });

  it("rejects a duplicate email", async () => {
    mockUserFindByEmail.mockResolvedValue(safeUser());

    const response = await request(app).post("/api/auth/register").send({
      email: safeUser().email,
      username: "different-name",
      password: "correct horse battery",
    });

    expect(response.status).toBe(409);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it("rejects a duplicate username", async () => {
    mockUserFindByUsername.mockResolvedValue(safeUser());

    const response = await request(app).post("/api/auth/register").send({
      email: "another@example.test",
      username: safeUser().username,
      password: "correct horse battery",
    });

    expect(response.status).toBe(409);
    expect(mockUserCreate).not.toHaveBeenCalled();
  });

  it("logs in with a valid password and omits the password hash", async () => {
    const passwordHash = await hashPassword("correct horse battery");
    mockUserFindByEmailForAuthentication.mockResolvedValue({ ...safeUser(), passwordHash });

    const response = await request(app).post("/api/auth/login").send({
      email: safeUser().email,
      password: "correct horse battery",
    });

    expect(response.status).toBe(200);
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(verifyAccessToken(response.body.data.token).userId).toBe(safeUser().id);
  });

  it("rejects an incorrect password and a nonexistent user with the same response", async () => {
    const passwordHash = await hashPassword("correct horse battery");
    mockUserFindByEmailForAuthentication.mockResolvedValue({ ...safeUser(), passwordHash });
    const wrongPassword = await request(app).post("/api/auth/login").send({
      email: safeUser().email,
      password: "incorrect password",
    });

    mockUserFindByEmailForAuthentication.mockResolvedValue(null);
    const missingUser = await request(app).post("/api/auth/login").send({
      email: "missing@example.test",
      password: "incorrect password",
    });

    expect(wrongPassword.status).toBe(401);
    expect(missingUser.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(missingUser.body.error.message);
  });

  it("returns the JWT identity's safe profile from /me", async () => {
    const token = createAccessToken(safeUser().id);
    const response = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(mockUserFindById).toHaveBeenCalledWith(safeUser().id);
    expect(response.body.data.user.passwordHash).toBeUndefined();
  });

  it("rejects missing, invalid, and expired bearer tokens", async () => {
    const missing = await request(app).get("/api/auth/me");
    const invalid = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer not-a-jwt");
    const expiredToken = jwt.sign({}, TEST_SECRET, {
      algorithm: "HS256",
      subject: safeUser().id,
      expiresIn: -1,
    });
    const expired = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(missing.status).toBe(401);
    expect(invalid.status).toBe(401);
    expect(expired.status).toBe(401);
  });

  it("rejects a token signed with the wrong secret or algorithm", async () => {
    const wrongSignature = jwt.sign({}, "different-phase9-secret-with-more-than-32", {
      algorithm: "HS256",
      subject: safeUser().id,
    });
    const wrongAlgorithm = jwt.sign({}, TEST_SECRET, {
      algorithm: "HS384",
      subject: safeUser().id,
    });

    const invalidSignatureResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${wrongSignature}`);
    const invalidAlgorithmResponse = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${wrongAlgorithm}`);

    expect(invalidSignatureResponse.status).toBe(401);
    expect(invalidAlgorithmResponse.status).toBe(401);
  });

  it("rejects a valid token for a deleted user profile", async () => {
    mockUserFindById.mockResolvedValue(null);
    const token = createAccessToken(safeUser().id);

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(401);
  });

  it("requires authentication for chat and derives identity from the token, not the body", async () => {
    const noToken = await request(app).post("/api/chat").send({ message: "Hello" });
    const token = createAccessToken(safeUser().id);
    const authenticated = await request(app)
      .post("/api/chat")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "Hello", userId: "attacker-selected-id" });

    expect(noToken.status).toBe(401);
    expect(authenticated.status).toBe(200);
    expect(mockChatSendMessage).toHaveBeenCalledWith({ message: "Hello" }, safeUser().id);
  });
});