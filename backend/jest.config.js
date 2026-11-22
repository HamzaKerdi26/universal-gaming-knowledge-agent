/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  setupFiles: ["<rootDir>/tests/setupTestEnv.ts"],
  clearMocks: true,
  testTimeout: 15000,
  testPathIgnorePatterns: [
    "/node_modules/",
    "\\.vscode\\",
  ],
};
