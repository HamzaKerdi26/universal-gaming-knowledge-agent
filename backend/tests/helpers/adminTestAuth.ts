import { randomUUID } from "crypto";

const ADMIN_USER_ID = randomUUID();
const NON_ADMIN_USER_ID = randomUUID();

process.env.JWT_SECRET ??= "phase10b-test-secret-with-at-least-32-characters";
process.env.ADMIN_USER_IDS = ADMIN_USER_ID;

const { createAccessToken } = require("../../src/utils/jwt") as typeof import("../../src/utils/jwt");
const { prisma } = require("../../src/config/prisma") as typeof import("../../src/config/prisma");

export const ADMIN_AUTHORIZATION = `Bearer ${createAccessToken(ADMIN_USER_ID)}`;
export const NON_ADMIN_AUTHORIZATION = `Bearer ${createAccessToken(NON_ADMIN_USER_ID)}`;

export async function createAdminTestUsers(): Promise<void> {
	await prisma.user.createMany({
		data: [
			{ id: ADMIN_USER_ID, username: `admin-test-${ADMIN_USER_ID}`, email: `admin-${ADMIN_USER_ID}@example.test`, passwordHash: "test-only-hash" },
			{ id: NON_ADMIN_USER_ID, username: `non-admin-test-${NON_ADMIN_USER_ID}`, email: `non-admin-${NON_ADMIN_USER_ID}@example.test`, passwordHash: "test-only-hash" },
		],
	});
}

export async function deleteAdminTestUsers(): Promise<void> {
	await prisma.user.deleteMany({ where: { id: { in: [ADMIN_USER_ID, NON_ADMIN_USER_ID] } } });
}