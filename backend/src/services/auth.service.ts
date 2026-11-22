import { Prisma } from "@prisma/client";
import { userRepository } from "../repositories/user.repository";
import { AuthResponse, LoginRequest, RegisterRequest, SafeUser } from "../types/auth";
import { ConflictError, NotFoundError, UnauthorizedError } from "../utils/AppError";
import { createAccessToken } from "../utils/jwt";
import { hashPassword, verifyPassword } from "../utils/password";

export const authService = {
  async register(input: RegisterRequest): Promise<AuthResponse> {
    const email = input.email.trim().toLowerCase();
    const username = input.username.trim();

    if (await userRepository.findByEmail(email)) {
      throw new ConflictError("An account with this email already exists");
    }
    if (await userRepository.findByUsername(username)) {
      throw new ConflictError("This username is already taken");
    }

    const passwordHash = await hashPassword(input.password);
    let user: SafeUser;
    try {
      user = await userRepository.create({ username, email, passwordHash });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictError(duplicateMessage(error));
      }
      throw error;
    }

    return { user, token: createAccessToken(user.id) };
  },

  async login(input: LoginRequest): Promise<AuthResponse> {
    const user = await userRepository.findByEmailForAuthentication(
      input.email.trim().toLowerCase()
    );
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const { passwordHash: _passwordHash, ...safeUser } = user;
    return { user: safeUser, token: createAccessToken(user.id) };
  },

  async getProfile(userId: string): Promise<SafeUser> {
    const user = await userRepository.findById(userId);
    if (!user) throw new NotFoundError("User not found");
    return user;
  },
};

function duplicateMessage(error: Prisma.PrismaClientKnownRequestError): string {
  const target = error.meta?.target;
  const fields = Array.isArray(target) ? target : [target];
  if (fields.includes("email")) return "An account with this email already exists";
  if (fields.includes("username")) return "This username is already taken";
  return "An account with this email or username already exists";
}