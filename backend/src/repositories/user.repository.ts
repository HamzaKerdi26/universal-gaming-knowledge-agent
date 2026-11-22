import { User } from "@prisma/client";
import { prisma } from "../config/prisma";
import { SafeUser } from "../types/auth";

const safeUserSelect = {
  id: true,
  username: true,
  email: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type UserForAuthentication = SafeUser & Pick<User, "passwordHash">;

export const userRepository = {
  create(data: { username: string; email: string; passwordHash: string }): Promise<SafeUser> {
    return prisma.user.create({ data, select: safeUserSelect });
  },

  findById(id: string): Promise<SafeUser | null> {
    return prisma.user.findUnique({ where: { id }, select: safeUserSelect });
  },

  findByEmail(email: string): Promise<SafeUser | null> {
    return prisma.user.findUnique({ where: { email }, select: safeUserSelect });
  },

  findByUsername(username: string): Promise<SafeUser | null> {
    return prisma.user.findUnique({ where: { username }, select: safeUserSelect });
  },

  findByEmailForAuthentication(email: string): Promise<UserForAuthentication | null> {
    return prisma.user.findUnique({
      where: { email },
      select: { ...safeUserSelect, passwordHash: true },
    });
  },
};